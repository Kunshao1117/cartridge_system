import { spawnSync } from 'node:child_process';

// Public registry reads only. No publication, credentials, fixes or lifecycle scripts.
function npmJson(label, args, expectedNotFound = false) {
  const result = spawnSync('npm', args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  if (result.error) throw result.error;
  if (result.signal) throw new Error(`${label}: interrupted by ${result.signal}`);
  console.log(`\n=== ${label} (exit ${result.status}) ===`);
  console.log(result.stdout);
  if (result.stderr) console.log(result.stderr);
  let data;
  try { data = JSON.parse(result.stdout); }
  catch { throw new Error(`${label}: npm did not return valid JSON`); }
  if (expectedNotFound && result.status !== 0 && data.error?.code === 'E404') {
    console.log('Target version is absent from the public registry. This is not a publish result.');
    return data;
  }
  if (data.error) throw new Error(`${label}: ${JSON.stringify(data.error)}`);
  if (args[0] === 'audit') {
    if (!data.metadata?.vulnerabilities || !data.vulnerabilities || ![0, 1].includes(result.status)) {
      throw new Error(`${label}: incomplete audit result`);
    }
    console.log(`AUDIT_SUMMARY ${label}: ${JSON.stringify(data.metadata.vulnerabilities)}`);
  } else if (result.status !== 0) {
    throw new Error(`${label}: unexpected npm failure ${result.status}`);
  }
  return data;
}

const errors = [];
for (const [label, args, notFound] of [
  ['Registry versions and tags', ['view', 'cartridge-system', 'dist-tags', 'versions', '--json'], false],
  ['Target version 5.5.5', ['view', 'cartridge-system@5.5.5', 'version', 'gitHead', 'dist', '--json'], true],
  ['Full dependency audit', ['audit', '--json'], false],
  ['Production dependency audit', ['audit', '--omit=dev', '--json'], false],
]) {
  try { npmJson(label, args, notFound); }
  catch (error) { errors.push(`${label}: ${error.message}`); }
}
if (errors.length) throw new Error(errors.join('\n'));
