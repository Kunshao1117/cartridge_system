import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';

const version = process.env.PUBLISH_VERSION;
const revision = process.env.GITHUB_SHA;
if (!/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(version ?? '') || !/^[a-f0-9]{40}$/.test(revision ?? '')) {
  throw new Error('PUBLISH_VERSION and exact GITHUB_SHA are required');
}
const registry = 'https://registry.npmjs.org';
async function request(url) {
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(30_000), redirect: 'error' });
      if (response.ok) return response;
      if (![404, 408, 429].includes(response.status) && response.status < 500) {
        throw new Error(`Non-retryable registry HTTP ${response.status}`);
      }
      if (attempt === 5) throw new Error(`Registry HTTP ${response.status} after bounded retries`);
    } catch (error) {
      if (attempt === 5 || String(error).includes('Non-retryable')) throw error;
    }
    await new Promise(resolve => setTimeout(resolve, 10_000));
  }
  throw new Error('Registry did not converge');
}
function requireRegistryUrl(value) {
  const url = new URL(value);
  if (url.origin !== 'https://registry.npmjs.org') throw new Error('Unexpected registry artifact destination');
  return url;
}
const metadata = await (await request(`${registry}/cartridge-system/${version}`)).json();
// A successful existing-version skip is not proof of this source revision.
if (metadata.name !== 'cartridge-system' || metadata.version !== version || metadata.gitHead !== revision) {
  throw new Error(`Published source/version mismatch: ${JSON.stringify({ name: metadata.name, version: metadata.version, gitHead: metadata.gitHead, expected: revision })}`);
}
const dist = metadata.dist;
if (!dist?.tarball || !dist?.integrity || !dist?.shasum) throw new Error('Published distribution metadata is incomplete');
const archive = Buffer.from(await (await request(requireRegistryUrl(dist.tarball))).arrayBuffer());
const integrity = `sha512-${createHash('sha512').update(archive).digest('base64')}`;
const shasum = createHash('sha1').update(archive).digest('hex');
const sha512Hex = createHash('sha512').update(archive).digest('hex');
if (!dist.integrity.split(/\s+/).includes(integrity) || dist.shasum !== shasum) throw new Error('Published tarball integrity mismatch');
// Inspect tar bytes in memory; do not install or execute published code.
const tar = gunzipSync(archive, { maxOutputLength: 100 * 1024 * 1024 });
const files = new Map();
for (let offset = 0; offset + 512 <= tar.length;) {
  const header = tar.subarray(offset, offset + 512);
  if (header.every(byte => byte === 0)) break;
  const name = header.subarray(0, 100).toString().replace(/\0.*$/, '');
  const size = Number.parseInt(header.subarray(124, 136).toString().replace(/\0.*$/, '').trim(), 8);
  if (!Number.isSafeInteger(size) || size < 0 || offset + 512 + size > tar.length) throw new Error('Invalid npm tar archive');
  if (name === 'package/package.json' || name === 'package/dist/mcp-server.js') files.set(name, tar.subarray(offset + 512, offset + 512 + size).toString('utf8'));
  offset += 512 + Math.ceil(size / 512) * 512;
}
const manifest = JSON.parse(files.get('package/package.json') ?? '{}');
if (manifest.version !== version || manifest.name !== 'cartridge-system') throw new Error('Tarball manifest mismatch');
if (!files.get('package/dist/mcp-server.js')?.includes(version)) throw new Error('MCP bundle/version missing from tarball');
console.log(JSON.stringify({ name: metadata.name, version, gitHead: metadata.gitHead, tarball: dist.tarball, integrity, shasum, archiveManifestVerified: true, mcpBundlePresent: true, attestations: dist.attestations ?? null }, null, 2));
if (dist.attestations?.url) {
  const attestations = await (await request(requireRegistryUrl(dist.attestations.url))).json();
  const statements = (attestations.attestations ?? []).map(item => item.bundle?.dsseEnvelope?.payload)
    .filter(payload => typeof payload === 'string')
    .map(payload => JSON.parse(Buffer.from(payload, 'base64').toString('utf8')));
  const provenance = statements.filter(statement => statement.predicateType === 'https://slsa.dev/provenance/v1');
  if (provenance.length === 0) throw new Error('Published attestation metadata contains no supported provenance statement');
  const matchesSource = statement => {
    const config = statement.predicate?.buildDefinition?.externalParameters?.workflow;
    const dependencies = statement.predicate?.buildDefinition?.resolvedDependencies ?? statement.predicate?.materials ?? [];
    const expectedRepository = 'https://github.com/Kunshao1117/cartridge_system';
    return config?.repository === expectedRepository &&
      config?.path === '.github/workflows/npm-publish.yml' &&
      dependencies.some(dependency => (dependency.uri === `git+${expectedRepository}` || String(dependency.uri ?? '').startsWith(`git+${expectedRepository}@`)) && dependency.digest?.gitCommit === revision) &&
      (statement.subject ?? []).some(subject => subject.name === `pkg:npm/cartridge-system@${version}` && subject.digest?.sha512 === sha512Hex);
  };
  if (!provenance.some(matchesSource)) throw new Error('Provenance metadata does not identify the expected repository/revision');
  console.log('Provenance statement source metadata matches. This step does not perform independent signature/transparency-log cryptographic verification.');
} else {
  console.log('No registry attestation metadata returned; signature/provenance verification is unavailable.');
}
