import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { command, verifyReleaseSource } from './release-source.mjs';
import { verifyPublishedNpmSource } from './npm-release-source.mjs';

const markerPrefix = '<!-- cartridge-release-source:';
const sourceRecord = ({ schemaVersion, repository, surface, version, tag, revision }) => ({ schemaVersion, repository, surface, version, tag, revision });

export function sourceNotes(notes, source) {
  if (notes.includes(markerPrefix)) throw new Error('Release notes must not supply a source marker');
  return `${notes.trim()}\n\n${markerPrefix}${JSON.stringify(sourceRecord(source))} -->\n`;
}

export function requireReleaseSource(release, source) {
  const markers = (release.body ?? '').match(/<!-- cartridge-release-source:([^\n]*?) -->/g) ?? [];
  if (release.tag_name !== source.tag) throw new Error('Existing release tag mismatch');
  if (!(release.body ?? '').includes(markerPrefix)) return false; // Legacy provenance stays explicitly unverified.
  if (markers.length !== 1 || (release.body ?? '').split(markerPrefix).length !== 2) throw new Error('Existing release has no unique source record');
  const saved = JSON.parse(markers[0].slice(markerPrefix.length, -4));
  if (release.tag_name !== source.tag || Object.keys(sourceRecord(source)).some(key => saved[key] !== source[key])) {
    throw new Error('Existing release source mismatch; published versions cannot be rebuilt from another SHA');
  }
  return true;
}

function readRelease(source, run, options) {
  // The by-tag REST endpoint only guarantees published releases. Listing with
  // the workflow token also sees drafts, so a failed upload can resume safely.
  const pages = JSON.parse(run('gh', ['api', '--paginate', '--slurp', `repos/${source.repository}/releases?per_page=100`], options));
  if (!Array.isArray(pages) || !pages.every(Array.isArray)) throw new Error('Invalid release listing');
  const matches = pages.flat().filter(release => release.tag_name === source.tag);
  if (matches.length > 1) throw new Error('Multiple releases use the same tag');
  return matches[0] ?? null;
}

// Only this explicitly invoked CLI publishes. Imports are safe for regression
// tests, whose command transport is fake and never reaches GitHub.
export async function publishGitHubRelease(surface, { cwd = process.cwd(), env = process.env, run = command, fetchImpl = fetch } = {}) {
  if (!['vsix', 'desktop'].includes(surface)) throw new Error('Unsupported GitHub release surface');
  if (!env.RELEASE_SOURCE_SHA) throw new Error('Pre-build source gate is required');
  const options = { cwd, env };
  const checkSource = async (requireSelectedTag = false) => {
    const current = verifyReleaseSource(surface, { ...options, run, requireSelectedTag });
    await verifyPublishedNpmSource(current, { fetchImpl });
    return verifyReleaseSource(surface, { ...options, run, requireSelectedTag });
  };
  const source = await checkSource(env.GITHUB_EVENT_NAME === 'push');
  const assetPath = surface === 'vsix' ? env.VSIX_PATH : env.DESKTOP_INSTALLER_PATH;
  const notesPath = surface === 'vsix' ? 'RELEASE_NOTES.md' : 'DESKTOP_RELEASE_NOTES.md';
  const title = surface === 'vsix' ? `Cartridge System ${source.tag}` : `Cartridge Desktop Console ${source.tag}`;
  if (!assetPath) throw new Error('Release artifact path is required');
  const asset = path.resolve(cwd, assetPath);
  if (!statSync(asset).isFile() || statSync(asset).size === 0) throw new Error('Release artifact is empty or not a file');
  const assetName = path.basename(asset);
  const expectedName = surface === 'vsix' ? `cartridge-system-${source.version}.vsix` : `Cartridge Desktop Console Setup ${source.version}.exe`;
  if (assetName !== expectedName) throw new Error(`Unexpected release artifact: ${assetName}`);
  const releaseArgs = ['--repo', source.repository];
  let release = readRelease(source, run, options);
  if (!release) {
    const temporary = mkdtempSync(path.join(os.tmpdir(), 'cartridge-release-'));
    try {
      const notes = path.join(temporary, 'notes.md');
      writeFileSync(notes, sourceNotes(readFileSync(path.join(cwd, notesPath), 'utf8'), source));
      // Source identity is part of the initial create request. A failed asset
      // upload therefore leaves a recoverable draft with its original source.
      const current = await checkSource();
      run('gh', ['release', 'create', source.tag, ...releaseArgs, '--draft', ...(current.selectedTagExists ? ['--verify-tag'] : []), '--target', source.revision, '--title', title, '--notes-file', notes], options);
    } finally {
      rmSync(temporary, { recursive: true, force: true });
    }
    release = readRelease(source, run, options);
    if (!release) throw new Error('Created release could not be verified');
  }
  const releaseSourceVerified = requireReleaseSource(release, source);
  // A draft may reserve a not-yet-created tag. Only our source-marked draft
  // bound to the exact immutable target SHA may recover in that state.
  const draftOwnsPendingTag = releaseSourceVerified && release.draft && release.target_commitish === source.revision;
  await checkSource(!draftOwnsPendingTag);
  const matchingAssets = (release.assets ?? []).filter(item => item.name === assetName);
  if (matchingAssets.length > 1) throw new Error('Duplicate release artifact names');
  if (matchingAssets.length === 0) {
    await checkSource(!draftOwnsPendingTag);
    // Never overwrite an existing asset, including a cross-SHA or legacy asset.
    // An upload collision fails safely; the next same-source run can inspect it.
    run('gh', ['release', 'upload', source.tag, `${asset}#cartridge-source-sha:${source.revision}`, ...releaseArgs], options);
    release = readRelease(source, run, options);
    if (!release) throw new Error('Uploaded release could not be verified');
    requireReleaseSource(release, source);
  }
  const uploaded = (release.assets ?? []).filter(item => item.name === assetName);
  if (uploaded.length !== 1 || uploaded[0].state !== 'uploaded' || !(uploaded[0].size > 0)) {
    throw new Error('Release asset is incomplete; refusing to overwrite or publish it');
  }
  const label = uploaded[0].label ?? '';
  if (label.startsWith('cartridge-source-sha:') && label !== `cartridge-source-sha:${source.revision}`) {
    throw new Error('Existing artifact source mismatch; refusing to overwrite it');
  }
  const assetSourceVerified = releaseSourceVerified || label === `cartridge-source-sha:${source.revision}`;
  // Do not publish someone else's unmarked legacy draft as a side effect of
  // missing-asset recovery. Its title, notes and draft status remain unchanged.
  if (release.draft && releaseSourceVerified) {
    await checkSource(!draftOwnsPendingTag);
    run('gh', ['release', 'edit', source.tag, ...releaseArgs, '--draft=false', surface === 'vsix' ? '--latest' : '--latest=false'], options);
    release = readRelease(source, run, options);
    if (!release) throw new Error('Published release could not be verified');
    requireReleaseSource(release, source);
    if (release.draft) throw new Error('Release is still a draft');
    await checkSource(true);
  }
  return {
    ...sourceRecord(source), asset: assetName, retainedExistingAsset: matchingAssets.length === 1,
    releaseSourceVerified, assetSourceVerified, draft: release.draft,
    warnings: releaseSourceVerified ? [] : ['Legacy release source record is absent; original asset provenance is unverified. Existing assets, title and notes were retained.'],
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(await publishGitHubRelease(process.argv[2])));
}
