import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, readFileSync, statSync, writeFileSync, appendFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

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
if (process.env.GITHUB_ENV) appendFileSync(process.env.GITHUB_ENV, `PREPUBLICATION_VERSION=${manifest.version}\n`);
console.log(JSON.stringify(record, null, 2));
