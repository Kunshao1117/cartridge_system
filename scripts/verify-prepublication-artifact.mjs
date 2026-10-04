import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, readFileSync, statSync, writeFileSync, appendFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';


export const MAX_PART_BYTES = 24 * 1024 * 1024;
const MAX_PARTS = 8;
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const safeName = name => typeof name === 'string' && /^[A-Za-z0-9][A-Za-z0-9 ._-]*$/.test(name) && !name.includes('..');

// Small authenticated CI artifacts solve a per-file transfer size limit only.
// They do not change access controls, the installer, or its original digest.
export function splitArtifact(bytes, record, partSize = MAX_PART_BYTES) {
  if (!Buffer.isBuffer(bytes) || bytes.length === 0 || !Number.isSafeInteger(partSize) || partSize < 1 || partSize > MAX_PART_BYTES || !safeName(record?.artifact?.name)) throw new Error('Invalid artifact segmentation input');
  if (record.artifact.size !== bytes.length || record.artifact.sha256 !== sha256(bytes)) throw new Error('Full artifact does not match its source record');
  const count = Math.ceil(bytes.length / partSize);
  if (count > MAX_PARTS) throw new Error('Artifact exceeds supported part count');
  const parts = Array.from({ length: count }, (_, index) => {
    const data = bytes.subarray(index * partSize, Math.min((index + 1) * partSize, bytes.length));
    return { sequence: index + 1, name: `${record.artifact.name}.part-${String(index + 1).padStart(2, '0')}`, size: data.length, sha256: sha256(data), bytes: data };
  });
  return { manifest: { schemaVersion: 1, source: record.source, artifact: record.artifact, partSize, parts: parts.map(({ bytes: _bytes, ...part }) => part) }, parts };
}

export function reassembleArtifact(manifest, readPart) {
  if (manifest?.schemaVersion !== 1 || !safeName(manifest.artifact?.name) || !Number.isSafeInteger(manifest.artifact?.size) || manifest.artifact.size < 1 || !/^[a-f0-9]{64}$/.test(manifest.artifact.sha256 ?? '') || !/^[a-f0-9]{40}$/.test(manifest.source?.revision ?? '') || !/^[a-f0-9]{40}$/.test(manifest.source?.tree ?? '') || !Number.isSafeInteger(manifest.partSize) || manifest.partSize < 1 || manifest.partSize > MAX_PART_BYTES || !Array.isArray(manifest.parts) || manifest.parts.length < 1 || manifest.parts.length > MAX_PARTS || manifest.parts.length !== Math.ceil(manifest.artifact.size / manifest.partSize)) throw new Error('Invalid artifact parts manifest');
  const buffers = manifest.parts.map((part, index) => {
    const expectedName = `${manifest.artifact.name}.part-${String(index + 1).padStart(2, '0')}`;
    const expectedSize = Math.min(manifest.partSize, manifest.artifact.size - index * manifest.partSize);
    if (part.sequence !== index + 1 || part.name !== expectedName || part.size !== expectedSize || !/^[a-f0-9]{64}$/.test(part.sha256 ?? '')) throw new Error('Invalid artifact part order, name, or size');
    const bytes = readPart(part.name);
    if (!Buffer.isBuffer(bytes) || bytes.length !== part.size || sha256(bytes) !== part.sha256) throw new Error('Artifact part is missing, truncated, or corrupted');
    return bytes;
  });
  const bytes = Buffer.concat(buffers);
  if (bytes.length !== manifest.artifact.size || sha256(bytes) !== manifest.artifact.sha256) throw new Error('Reassembled artifact digest mismatch');
  return bytes;
}

function main() {
  // Inspect built packages without publishing, installing, or executing them.
  const surface = process.argv[2];
  const manifest = JSON.parse(readFileSync('package.json', 'utf8'));
  if (!['vsix', 'desktop'].includes(surface) || !/^\d+\.\d+\.\d+$/.test(manifest.version)) throw new Error('Invalid package surface/version');
  const revision = process.env.PREPUBLICATION_SHA;
  if (!/^[a-f0-9]{40}$/.test(revision ?? '')) throw new Error('Exact source SHA required');
  const git = arg => {
    const result = spawnSync('git', ['rev-parse', arg], { encoding: 'utf8' });
    if (result.error || result.status !== 0) throw new Error(`Cannot inspect source: ${result.stderr}`);
    return result.stdout.trim();
  };
  if (git('HEAD') !== revision) throw new Error('Prepublication checkout differs from required source');
  const name = surface === 'vsix' ? `cartridge-system-${manifest.version}.vsix` : `Cartridge Desktop Console Setup ${manifest.version}.exe`;
  const artifact = surface === 'vsix' ? name : path.join('release/desktop', name);
  if (!statSync(artifact).isFile()) throw new Error('Expected package is missing');
  let artifactManifest;
  if (surface === 'vsix') {
    const result = spawnSync('unzip', ['-p', artifact, 'extension/package.json'], { encoding: 'utf8', maxBuffer: 1024 * 1024 });
    if (result.error || result.status !== 0) throw new Error('Cannot inspect VSIX manifest');
    artifactManifest = JSON.parse(result.stdout);
    if (artifactManifest.name !== manifest.name || artifactManifest.version !== manifest.version || artifactManifest.main !== manifest.main) throw new Error('VSIX manifest mismatch');
  } else {
    const productVersion = process.env.PREPUBLICATION_PRODUCT_VERSION;
    if (productVersion !== manifest.version && productVersion !== `${manifest.version}.0`) throw new Error(`Installer product version mismatch: ${productVersion}`);
    artifactManifest = { name: manifest.name, version: manifest.version, productVersion };
  }
  const bytes = readFileSync(artifact);
  if (bytes.length === 0) throw new Error('Built package is empty');
  const record = { schemaVersion: 1, surface, version: manifest.version, source: { revision, tree: git('HEAD^{tree}'), repository: process.env.GITHUB_REPOSITORY ?? null, workflowRun: process.env.GITHUB_RUN_ID ?? null }, artifact: { name, size: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') }, manifest: { name: artifactManifest.name, version: artifactManifest.version, main: artifactManifest.main ?? null, productVersion: artifactManifest.productVersion ?? null }, published: false, installedOrExecuted: false };
  const output = 'prepublication-artifacts';
  mkdirSync(output, { recursive: true });
  copyFileSync(artifact, path.join(output, name));
  writeFileSync(path.join(output, `${surface}-source.json`), `${JSON.stringify(record, null, 2)}\n`);
  if (surface === 'desktop') {
    const delivery = splitArtifact(bytes, record);
    // Test the exact transport representation before exposing any part to CI.
    const byName = new Map(delivery.parts.map(part => [part.name, part.bytes]));
    if (!reassembleArtifact(delivery.manifest, partName => byName.get(partName)).equals(bytes)) throw new Error('Segment roundtrip mismatch');
    const indexPath = path.join('prepublication-segments', 'index');
    mkdirSync(indexPath, { recursive: true });
    writeFileSync(path.join(indexPath, 'parts-manifest.json'), `${JSON.stringify(delivery.manifest, null, 2)}\n`);
    writeFileSync(path.join(indexPath, 'desktop-source.json'), `${JSON.stringify(record, null, 2)}\n`);
    for (const part of delivery.parts) {
      const directory = path.join('prepublication-segments', `part-${String(part.sequence).padStart(2, '0')}`);
      mkdirSync(directory, { recursive: true });
      writeFileSync(path.join(directory, part.name), part.bytes);
    }
    if (process.env.GITHUB_ENV) appendFileSync(process.env.GITHUB_ENV, `PREPUBLICATION_PART_COUNT=${delivery.parts.length}\n`);
    console.log(JSON.stringify(delivery.manifest, null, 2));
  }
  if (process.env.GITHUB_ENV) appendFileSync(process.env.GITHUB_ENV, `PREPUBLICATION_VERSION=${manifest.version}\n`);
  console.log(JSON.stringify(record, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
