// CI-only candidate generator. Never commits, publishes, uploads, or executes install scripts.
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const selected = ['js-yaml', 'fast-uri', 'ip-address', '@hono/node-server', 'hono', 'body-parser', 'qs', 'electron', 'tar'];
const before = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));
const manifest = JSON.parse(fs.readFileSync('package.json', 'utf8'));
manifest.devDependencies.electron = '^42.9.2';
fs.writeFileSync('package.json', `${JSON.stringify(manifest, null, 2)}\n`);
const command = ['update', ...selected, '--package-lock-only', '--ignore-scripts', '--save=false'];
const result = spawnSync('npm', command, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
console.log(result.stdout);
console.log(result.stderr);
if (result.error || result.status !== 0) throw result.error ?? new Error(`Lock candidate generation failed: ${result.status}`);
const after = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));
const nodes = new Set([...Object.keys(before.packages ?? {}), ...Object.keys(after.packages ?? {})]);
const changed = [...nodes].filter(key => JSON.stringify(before.packages?.[key]) !== JSON.stringify(after.packages?.[key]));
console.log('SECURITY_LOCK_NODE_DELTA ' + JSON.stringify(changed.map(key => ({ path: key, before: before.packages?.[key], after: after.packages?.[key] }))));
for (const file of ['package.json', 'package-lock.json']) {
  const bytes = fs.readFileSync(file);
  const encoded = bytes.toString('base64');
  const chunks = encoded.match(/.{1,4096}/g) ?? [];
  console.log('SECURITY_LOCK_BEGIN ' + JSON.stringify({ file, sourceSha: process.env.GITHUB_SHA, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), chunks: chunks.length }));
  for (const [index, chunk] of chunks.entries()) console.log(`SECURITY_LOCK_CHUNK ${file} ${index + 1}/${chunks.length} ${chunk}`);
  console.log(`SECURITY_LOCK_END ${file}`);
}
