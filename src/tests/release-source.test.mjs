import fs from 'node:fs';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { command, releaseEnvironment, releaseVersion, verifyReleaseSource } from '../../scripts/release-source.mjs';
import { publishGitHubRelease, requireReleaseSource, sourceNotes } from '../../scripts/publish-github-release.mjs';
import { verifyPublishedNpmSource } from '../../scripts/npm-release-source.mjs';

const roots = [];
const projectRoot = process.cwd();
const version = '5.5.5';
const prefixes = { vsix: 'v', desktop: 'desktop-v', npm: 'npm-v' };

afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

// These are isolated local Git fixtures. No command ever targets GitHub.
function fixture(surface = 'vsix', selectedTag = true) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cartridge-release-test-'));
  roots.push(root);
  const cwd = path.join(root, 'checkout');
  const remote = path.join(root, 'remote.git');
  fs.mkdirSync(cwd);
  const env = { ...process.env, GITHUB_EVENT_NAME: 'workflow_dispatch', GITHUB_REPOSITORY: 'example/cartridge', RELEASE_INPUT_VERSION: version };
  delete env.RELEASE_SOURCE_SHA;
  const git = (...args) => command('git', args, { cwd, env });
  git('init');
  git('config', 'user.email', 'release-fixture@example.invalid');
  git('config', 'user.name', 'Release fixture');
  git('config', 'commit.gpgsign', 'false');
  git('config', 'tag.gpgsign', 'false');
  fs.writeFileSync(path.join(cwd, 'package.json'), JSON.stringify({ name: 'cartridge-system', version }));
  git('add', 'package.json');
  git('commit', '-m', 'fixture source');
  const revision = git('rev-parse', 'HEAD');
  env.GITHUB_SHA = revision;
  git('init', '--bare', remote);
  git('remote', 'add', 'origin', remote);
  const tag = (name, sha = revision, annotated = false) => {
    git('tag', ...(annotated ? ['-a', name, sha, '-m', 'annotated fixture'] : [name, sha]));
    git('push', 'origin', `refs/tags/${name}`);
  };
  if (selectedTag) tag(`${prefixes[surface]}${version}`);
  return { root, cwd, env, git, tag, revision };
}

function secondCommit(test) {
  fs.writeFileSync(path.join(test.cwd, 'change.txt'), 'different source');
  test.git('add', 'change.txt');
  test.git('commit', '-m', 'different revision with same package version');
  return test.git('rev-parse', 'HEAD');
}

describe('release source gate used by all publishing workflows', () => {
  it.each(Object.keys(prefixes))('%s accepts matching lightweight tags and absent peer tags', (surface) => {
    const test = fixture(surface);
    expect(verifyReleaseSource(surface, test)).toMatchObject({ revision: test.revision, tag: `${prefixes[surface]}${version}` });
  });

  it.each(Object.keys(prefixes))('%s permits manual initial publication before its tag exists', (surface) => {
    const test = fixture(surface, false);
    expect(verifyReleaseSource(surface, test)).toMatchObject({ revision: test.revision, selectedTagExists: false });
  });

  it('peels annotated tags and permits a mix of all three matching tags', () => {
    const test = fixture('vsix', false);
    test.tag(`v${version}`, test.revision, true);
    test.tag(`desktop-v${version}`, test.revision, true);
    test.tag(`npm-v${version}`);
    for (const surface of Object.keys(prefixes)) expect(verifyReleaseSource(surface, test).revision).toBe(test.revision);
  });

  it.each(Object.keys(prefixes))('%s rejects a push whose selected tag is missing even with a matching peer', (surface) => {
    const test = fixture(surface, false);
    const peer = Object.keys(prefixes).find(value => value !== surface);
    test.tag(`${prefixes[peer]}${version}`);
    test.env.GITHUB_EVENT_NAME = 'push';
    test.env.GITHUB_REF_NAME = `${prefixes[surface]}${version}`;
    expect(() => verifyReleaseSource(surface, test)).toThrow('Required release tag is missing');
  });

  it.each(Object.keys(prefixes))('%s rejects a dispatch at a different SHA with the same package version', (surface) => {
    const test = fixture(surface);
    test.env.GITHUB_SHA = secondCommit(test);
    expect(() => verifyReleaseSource(surface, test)).toThrow('Release source mismatch');
  });

  it.each(Object.keys(prefixes))('%s rejects a conflicting existing peer tag', (surface) => {
    const test = fixture(surface);
    const other = secondCommit(test);
    const peer = Object.keys(prefixes).find(value => value !== surface);
    test.tag(`${prefixes[peer]}${version}`, other, true);
    test.git('checkout', '--detach', test.revision);
    expect(() => verifyReleaseSource(surface, test)).toThrow('Release source mismatch');
  });

  it('uses fresh remote refs, detecting a peer moved after the pre-build gate', () => {
    const test = fixture();
    test.tag(`npm-v${version}`);
    test.env.RELEASE_SOURCE_SHA = verifyReleaseSource('vsix', test).revision;
    const other = secondCommit(test);
    test.git('tag', '-f', `npm-v${version}`, other);
    test.git('push', '--force', 'origin', `refs/tags/npm-v${version}`);
    test.git('tag', '-f', `npm-v${version}`, test.revision); // stale local tag is deliberately valid
    test.git('checkout', '--detach', test.revision);
    expect(() => verifyReleaseSource('vsix', test)).toThrow('Release source mismatch');
  });

  it('rejects a checkout different from GITHUB_SHA before reading remote refs', () => {
    const test = fixture();
    test.env.GITHUB_SHA = 'f'.repeat(40);
    expect(() => verifyReleaseSource('vsix', test)).toThrow('Checkout/source mismatch');
  });

  it('rejects checkout changes after the pre-build gate', () => {
    const test = fixture();
    test.env.RELEASE_SOURCE_SHA = 'f'.repeat(40);
    expect(() => verifyReleaseSource('vsix', test)).toThrow('Source changed after the pre-build gate');
  });

  it('requires the matching push tag and package version', () => {
    const test = fixture();
    test.env.GITHUB_EVENT_NAME = 'push';
    test.env.GITHUB_REF_NAME = `v${version}`;
    expect(verifyReleaseSource('vsix', test).version).toBe(version);
    test.env.GITHUB_REF_NAME = version;
    expect(() => verifyReleaseSource('vsix', test)).toThrow('Push did not select this release tag');
    test.env.GITHUB_REF_NAME = `v${version}`;
    fs.writeFileSync(path.join(test.cwd, 'package.json'), '{"version":"5.5.6"}');
    expect(() => verifyReleaseSource('vsix', test)).toThrow('Version mismatch');
  });

  it.each(['', 'v', '5.5.5\nINJECT=value', '$(echo injected)', '05.5.5', '5.5.5-01'])('rejects unsafe or invalid version %j', (raw) => {
    expect(() => releaseVersion('vsix', raw)).toThrow('Invalid');
  });

  it('fails closed when the remote cannot be read', () => {
    const test = fixture();
    test.git('remote', 'set-url', 'origin', path.join(test.root, 'missing.git'));
    expect(() => verifyReleaseSource('vsix', test)).toThrow('git failed');
  });

  it('runs the same CLI used by workflows and writes source-bound environment values', () => {
    const test = fixture('npm');
    test.env.GITHUB_ENV = path.join(test.root, 'github-env');
    const preload = path.join(test.root, 'fake-registry.mjs');
    fs.writeFileSync(preload, 'globalThis.fetch = async () => new Response(null, { status: 404 });');
    const result = spawnSync(process.execPath, ['--import', pathToFileURL(preload).href, path.join(projectRoot, 'scripts/release-source.mjs'), 'npm', '--write-env'], { cwd: test.cwd, env: test.env, encoding: 'utf8' });
    expect(result.status, result.stderr).toBe(0);
    const source = JSON.parse(result.stdout);
    expect(fs.readFileSync(test.env.GITHUB_ENV, 'utf8')).toBe(releaseEnvironment(source));
    expect(source.revision).toBe(test.revision);
  });
});

function publishingFixture(surface = 'vsix', selectedTag = true) {
  const test = fixture(surface, selectedTag);
  test.env.RELEASE_SOURCE_SHA = test.revision;
  const source = verifyReleaseSource(surface, test);
  const name = surface === 'vsix' ? `cartridge-system-${version}.vsix` : `Cartridge Desktop Console Setup ${version}.exe`;
  test.env[surface === 'vsix' ? 'VSIX_PATH' : 'DESKTOP_INSTALLER_PATH'] = name;
  fs.writeFileSync(path.join(test.cwd, name), 'fixture artifact');
  fs.writeFileSync(path.join(test.cwd, surface === 'vsix' ? 'RELEASE_NOTES.md' : 'DESKTOP_RELEASE_NOTES.md'), '# Fixture notes');
  const artifact = Buffer.from('fixture artifact');
  const digest = `sha256:${createHash('sha256').update(artifact).digest('hex')}`;
  const state = { release: null, calls: [], failUpload: false, artifact, digest, nextAssetId: 101, transformAsset: asset => asset };
  const run = (program, args, options) => {
    if (program === 'git') return command(program, args, options);
    if (program !== 'gh') throw new Error('Unexpected command');
    state.calls.push(args);
    if (args[0] === 'api') return JSON.stringify([state.release ? [state.release] : []]);
    if (args[1] === 'create') {
      state.release = { tag_name: source.tag, target_commitish: source.revision, draft: true, body: fs.readFileSync(args[args.indexOf('--notes-file') + 1], 'utf8'), assets: [] };
      return '';
    }
    if (args[1] === 'upload') {
      if (state.failUpload) throw new Error('simulated interrupted upload');
      state.release.assets.push(state.transformAsset({ id: state.nextAssetId++, name: name.replaceAll(' ', '.'), state: 'uploaded', size: artifact.length, digest, label: args[3].split('#')[1] }));
      return '';
    }
    if (args[1] === 'download') {
      fs.writeFileSync(path.join(args[args.indexOf('--dir') + 1], args[args.indexOf('--pattern') + 1]), state.artifact);
      return '';
    }
    if (args[1] === 'edit') {
      if (!verifyReleaseSource(surface, test).selectedTagExists) test.tag(source.tag, source.revision);
      state.release.draft = false;
      return '';
    }
    throw new Error(`Unexpected gh command: ${args.join(' ')}`);
  };
  return { ...test, source, name, state, run, fetchImpl: async () => new Response(null, { status: 404 }) };
}

const writes = state => state.calls.filter(args => args[0] === 'release' && args[1] !== 'download');

describe('safe GitHub release helper with simulated GitHub transport', () => {
  it.each(['vsix', 'desktop'])('%s saves identity in the initial draft, uploads once, and safely retains it on rerun', async (surface) => {
    const test = publishingFixture(surface);
    expect((await publishGitHubRelease(surface, test)).retainedExistingAsset).toBe(false);
    expect(requireReleaseSource(test.state.release, test.source)).toBe(true);
    expect(writes(test.state).map(args => args[1])).toEqual(['create', 'upload', 'edit']);
    expect(writes(test.state)[0]).toContain('--verify-tag');
    expect(writes(test.state)[0]).toContain(test.revision);
    expect(writes(test.state)[2]).toContain(surface === 'vsix' ? '--latest' : '--latest=false');
    test.state.calls.length = 0;
    fs.writeFileSync(path.join(test.cwd, test.name), 'non-reproducible rebuild from same source');
    expect((await publishGitHubRelease(surface, test)).retainedExistingAsset).toBe(true);
    expect(writes(test.state)).toEqual([]);
  });

  it.each(['vsix', 'desktop'])('%s preserves manual first release, creating its missing tag at the exact checked SHA', async (surface) => {
    const test = publishingFixture(surface, false);
    await publishGitHubRelease(surface, test);
    const create = writes(test.state)[0];
    expect(create).not.toContain('--verify-tag');
    expect(create[create.indexOf('--target') + 1]).toBe(test.revision);
    expect(verifyReleaseSource(surface, test).selectedTagExists).toBe(true);
  });

  it('accepts the real GitHub Desktop space-to-dot name and verifies exact uploaded bytes', async () => {
    const test = publishingFixture('desktop', false);
    const result = await publishGitHubRelease('desktop', test);
    expect(result).toMatchObject({ asset: test.name.replaceAll(' ', '.'), assetId: 101, assetDigest: test.state.digest, draft: false });
    expect(test.state.calls.find(args => args[1] === 'download')).toContain(test.name.replaceAll(' ', '.'));
  });

  it.each(['digest', 'id', 'label', 'name'])('refuses a newly uploaded asset with mismatched %s', async (field) => {
    const test = publishingFixture('desktop', false);
    test.state.transformAsset = asset => ({ ...asset, [field]: { digest: `sha256:${'f'.repeat(64)}`, id: null, label: 'missing-source', name: 'unrelated.exe' }[field] });
    await expect(publishGitHubRelease('desktop', test)).rejects.toThrow(/artifact bytes|stable ID|source label|incomplete/);
    expect(test.state.release.draft).toBe(true);
    expect(writes(test.state).some(args => args[1] === 'edit')).toBe(false);
  });

  it('rejects collisions between exact and GitHub-normalized Desktop names', async () => {
    const test = publishingFixture('desktop');
    test.state.release = { tag_name: test.source.tag, draft: true, body: sourceNotes('notes', test.source), assets: [test.name, test.name.replaceAll(' ', '.')].map((name, index) => ({ id: index + 1, name, state: 'uploaded', size: 16, digest: test.state.digest, label: `cartridge-source-sha:${test.revision}` })) };
    await expect(publishGitHubRelease('desktop', test)).rejects.toThrow('Duplicate release artifact names');
    expect(writes(test.state)).toEqual([]);
  });

  it('verifies retained asset bytes against its own digest without comparing a new rebuild', async () => {
    const test = publishingFixture('desktop');
    await publishGitHubRelease('desktop', test);
    test.state.artifact = Buffer.from('corrupted remote bytes');
    test.state.calls.length = 0;
    await expect(publishGitHubRelease('desktop', test)).rejects.toThrow('Downloaded release asset digest or size mismatch');
    expect(writes(test.state)).toEqual([]);
  });

  it('rejects an asset whose stable identity changes during download verification', async () => {
    const test = publishingFixture('desktop');
    const run = (program, args, options) => {
      const value = test.run(program, args, options);
      if (program === 'gh' && args[1] === 'download') test.state.release.assets = test.state.release.assets.map(asset => ({ ...asset, id: asset.id + 1 }));
      return value;
    };
    await expect(publishGitHubRelease('desktop', { ...test, run })).rejects.toThrow('Release asset identity changed');
    expect(test.state.release.draft).toBe(true);
    expect(writes(test.state).some(args => args[1] === 'edit')).toBe(false);
  });

  it('recovers a missing asset after an interrupted upload using the original draft source', async () => {
    const test = publishingFixture();
    test.state.failUpload = true;
    await expect(publishGitHubRelease('vsix', test)).rejects.toThrow('simulated interrupted upload');
    expect(test.state.release.draft).toBe(true);
    expect(requireReleaseSource(test.state.release, test.source)).toBe(true);
    test.state.failUpload = false;
    test.state.calls.length = 0;
    expect((await publishGitHubRelease('vsix', test)).retainedExistingAsset).toBe(false);
    expect(writes(test.state).map(args => args[1])).toEqual(['upload', 'edit']);
  });

  it.each(['different-sha', 'duplicate-marker'])('refuses %s release provenance before any write', async (kind) => {
    const test = publishingFixture();
    const source = kind === 'different-sha' ? { ...test.source, revision: 'f'.repeat(40) } : test.source;
    const notes = sourceNotes('notes', source);
    test.state.release = { tag_name: test.source.tag, draft: false, body: kind === 'duplicate-marker' ? notes + notes : notes, assets: [{ name: test.name, state: 'uploaded', size: 16 }] };
    await expect(publishGitHubRelease('vsix', test)).rejects.toThrow(/source record|source mismatch/);
    expect(writes(test.state)).toEqual([]);
  });

  it('retains legacy assets and explicitly reports their original source as unverified', async () => {
    const test = publishingFixture();
    test.state.release = { tag_name: test.source.tag, draft: false, body: 'Original legacy notes', name: 'Original title', assets: [{ name: test.name, state: 'uploaded', size: 16 }] };
    const original = JSON.stringify(test.state.release);
    const result = await publishGitHubRelease('vsix', test);
    expect(result).toMatchObject({ retainedExistingAsset: true, releaseSourceVerified: false, assetSourceVerified: false });
    expect(result.warnings.join(' ')).toContain('original asset provenance is unverified');
    expect(JSON.stringify(test.state.release)).toBe(original);
    expect(writes(test.state)).toEqual([]);
  });

  it.each([false, true])('recovers only a missing legacy asset, preserving all existing metadata and draft=%s', async (draft) => {
    const test = publishingFixture();
    const originalAsset = { name: 'original-other-asset', state: 'uploaded', size: 10 };
    test.state.release = { tag_name: test.source.tag, draft, body: 'Original legacy notes', name: 'Original title', assets: [originalAsset] };
    const result = await publishGitHubRelease('vsix', test);
    expect(result).toMatchObject({ retainedExistingAsset: false, releaseSourceVerified: false, assetSourceVerified: true, draft });
    expect(test.state.release).toMatchObject({ draft, body: 'Original legacy notes', name: 'Original title' });
    expect(test.state.release.assets[0]).toEqual(originalAsset);
    expect(writes(test.state).map(args => args[1])).toEqual(['upload']);
    expect(writes(test.state)[0]).not.toContain('--clobber');
  });

  it('does not overwrite an incomplete existing asset', async () => {
    const test = publishingFixture();
    test.state.release = { tag_name: test.source.tag, draft: true, body: sourceNotes('notes', test.source), assets: [{ name: test.name, state: 'starter', size: 0 }] };
    await expect(publishGitHubRelease('vsix', test)).rejects.toThrow('Release asset is incomplete');
    expect(writes(test.state)).toEqual([]);
  });

  it('rejects a source-scoped asset label from another SHA', async () => {
    const test = publishingFixture();
    test.state.release = { tag_name: test.source.tag, draft: false, body: 'Legacy notes', assets: [{ name: test.name, state: 'uploaded', size: 16, label: `cartridge-source-sha:${'f'.repeat(40)}` }] };
    await expect(publishGitHubRelease('vsix', test)).rejects.toThrow('Existing artifact source mismatch');
    expect(writes(test.state)).toEqual([]);
  });

  it('does not interpret an API/authentication failure as a missing release', async () => {
    const test = publishingFixture();
    const run = (program, args, options) => {
      if (program === 'gh') throw new Error('HTTP 403');
      return test.run(program, args, options);
    };
    await expect(publishGitHubRelease('vsix', { ...test, run })).rejects.toThrow('HTTP 403');
    expect(writes(test.state)).toEqual([]);
  });

  it('rechecks remote identity at publication even when the initial gate passed', async () => {
    const test = publishingFixture();
    const other = secondCommit(test);
    test.tag(`desktop-v${version}`, other);
    test.git('checkout', '--detach', test.revision);
    await expect(publishGitHubRelease('vsix', test)).rejects.toThrow('Release source mismatch');
    expect(test.state.calls).toEqual([]);
  });

  it('rejects an existing npm publication from a different SHA before any GitHub write', async () => {
    const test = publishingFixture('vsix', false);
    test.fetchImpl = async () => Response.json({ name: 'cartridge-system', version, gitHead: 'f'.repeat(40) });
    await expect(publishGitHubRelease('vsix', test)).rejects.toThrow('npm release source mismatch');
    expect(test.state.calls).toEqual([]);
  });
});

const npmSource = { version, revision: 'a'.repeat(40) };

describe('read-only npm source gate', () => {
  it('treats only a registry 404 as not published', async () => {
    let destination;
    const fetchImpl = async (url, options) => {
      destination = url;
      expect(options.redirect).toBe('error');
      expect(options.signal).toBeInstanceOf(AbortSignal);
      return new Response(null, { status: 404 });
    };
    await expect(verifyPublishedNpmSource(npmSource, { fetchImpl })).resolves.toEqual({ published: false });
    expect(destination).toBe(`https://registry.npmjs.org/cartridge-system/${version}`);
  });

  it('accepts an existing version only with the same exact gitHead', async () => {
    const fetchImpl = async () => Response.json({ name: 'cartridge-system', version, gitHead: npmSource.revision });
    await expect(verifyPublishedNpmSource(npmSource, { fetchImpl })).resolves.toEqual({ published: true, revision: npmSource.revision });
  });

  it('rejects a different source SHA', async () => {
    const fetchImpl = async () => Response.json({ name: 'cartridge-system', version, gitHead: 'b'.repeat(40) });
    await expect(verifyPublishedNpmSource(npmSource, { fetchImpl })).rejects.toThrow('npm release source mismatch');
  });

  it.each([undefined, 'main', 'abc123'])('fails closed when gitHead has no exact source evidence (%s)', async (gitHead) => {
    const fetchImpl = async () => Response.json({ name: 'cartridge-system', version, gitHead });
    await expect(verifyPublishedNpmSource(npmSource, { fetchImpl })).rejects.toThrow('npm source evidence missing');
  });

  it.each([null, [], {}, { name: 'other-package', version }, { name: 'cartridge-system', version: '5.5.4' }].map(metadata => [metadata]))('rejects malformed metadata %j', async (metadata) => {
    const fetchImpl = async () => Response.json(metadata);
    await expect(verifyPublishedNpmSource(npmSource, { fetchImpl })).rejects.toThrow('validation unavailable: invalid package/version metadata');
  });

  it('rejects malformed JSON', async () => {
    const fetchImpl = async () => new Response('not json');
    await expect(verifyPublishedNpmSource(npmSource, { fetchImpl })).rejects.toThrow('validation unavailable: malformed registry JSON');
  });

  it.each([403, 429, 500, 503])('reports HTTP %s as validation unavailable, not a source mismatch or absent version', async (status) => {
    const fetchImpl = async () => new Response(null, { status });
    await expect(verifyPublishedNpmSource(npmSource, { fetchImpl })).rejects.toThrow(`validation unavailable: registry HTTP ${status}`);
  });

  it('reports a timeout as validation unavailable', async () => {
    const fetchImpl = async () => { throw new DOMException('request timed out', 'TimeoutError'); };
    await expect(verifyPublishedNpmSource(npmSource, { fetchImpl })).rejects.toThrow('validation unavailable: request timed out');
  });
});

describe('workflow wiring (without running a release workflow)', () => {
  it('checks real packages in read-only PR CI before any release trigger', () => {
    const workflow = fs.readFileSync(path.join(projectRoot, '.github/workflows/security-regression.yml'), 'utf8');
    expect(workflow).toContain('ref: ${{ github.event.pull_request.head.sha }}');
    expect(workflow).toContain('run: npm run prepublishOnly');
    expect(workflow).toContain('run: npm run package');
    expect(workflow).toContain('run: npm run desktop:dist -- --publish never');
    expect(workflow).toContain('node scripts/verify-prepublication-artifact.mjs vsix');
    expect(workflow).toContain('node scripts/verify-prepublication-artifact.mjs desktop');
    expect(workflow).toContain('PREPUBLICATION_SHA: ${{ github.event.pull_request.head.sha }}');
    expect(workflow).toContain('path: prepublication-artifacts/*');
    expect(workflow).toContain('if-no-files-found: error');
    expect(workflow).toContain('contents: read');
    expect(workflow).not.toContain('contents: write');
    expect(workflow).not.toContain('run: npm publish');
  });

  it.each([['release.yml', 'vsix'], ['desktop-release.yml', 'desktop'], ['npm-publish.yml', 'npm']])('%s uses the tested helper before dependencies and publication', (file, surface) => {
    const workflow = fs.readFileSync(path.join(projectRoot, '.github/workflows', file), 'utf8');
    expect(workflow).toContain('ref: ${{ github.sha }}');
    const gate = workflow.indexOf(`run: node scripts/release-source.mjs ${surface} --write-env`);
    expect(gate).toBeGreaterThan(0);
    expect(gate).toBeLessThan(workflow.indexOf('run: npm ci'));
    expect(workflow).toContain('RELEASE_INPUT_VERSION: ${{ inputs.version }}');
    expect(workflow).not.toContain('--clobber');
    expect(workflow).not.toMatch(/raw_?[Vv]ersion=.*\$\{\{/);
    if (surface === 'npm') {
      expect(workflow.indexOf('run: node scripts/release-source.mjs npm\n')).toBeLessThan(workflow.indexOf('run: npm publish'));
      expect(workflow).toContain('run: node scripts/verify-npm-publication.mjs');
    } else expect(workflow).toContain(`run: node scripts/publish-github-release.mjs ${surface}`);
  });
});
