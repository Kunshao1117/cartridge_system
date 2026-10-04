// Read-only source evidence. Imports do not query the registry or publish.
// A network/registry outage is not evidence that a version is available.
export async function verifyPublishedNpmSource(source, { fetchImpl = fetch } = {}) {
  const url = `https://registry.npmjs.org/cartridge-system/${encodeURIComponent(source.version)}`;
  let response;
  try {
    response = await fetchImpl(url, { signal: AbortSignal.timeout(30_000), redirect: 'error' });
  } catch (error) {
    throw new Error(`npm source validation unavailable: ${error.message}`, { cause: error });
  }
  if (response.status === 404) return { published: false };
  if (!response.ok) throw new Error(`npm source validation unavailable: registry HTTP ${response.status}`);
  let metadata;
  try { metadata = await response.json(); }
  catch (error) { throw new Error('npm source validation unavailable: malformed registry JSON', { cause: error }); }
  if (!metadata || Array.isArray(metadata) || metadata.name !== 'cartridge-system' || metadata.version !== source.version) {
    throw new Error('npm source validation unavailable: invalid package/version metadata');
  }
  if (!/^[a-f0-9]{40}$/.test(metadata.gitHead ?? '')) {
    throw new Error('npm source evidence missing: existing version has no valid exact gitHead');
  }
  if (metadata.gitHead !== source.revision) {
    throw new Error(`npm release source mismatch: existing gitHead ${metadata.gitHead}, checkout ${source.revision}`);
  }
  return { published: true, revision: metadata.gitHead };
}
