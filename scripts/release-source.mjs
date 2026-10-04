import { appendFileSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { verifyPublishedNpmSource } from './npm-release-source.mjs';

const prefixes = { vsix: 'v', desktop: 'desktop-v', npm: 'npm-v' };
const versionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
const shaPattern = /^[a-f0-9]{40}$/;

export function command(program, args, { cwd = process.cwd(), env = process.env, ...options } = {}) {
  const result = spawnSync(program, args, { cwd, env, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, ...options });
  if (result.error) throw result.error;
  if (result.signal || result.status !== 0) {
    const error = new Error(`${program} failed (${result.signal ?? result.status}): ${result.stderr}`);
    error.stderr = result.stderr;
    throw error;
  }
  return result.stdout.trim();
}

export function releaseVersion(surface, raw) {
  const prefix = prefixes[surface];
  if (!prefix || typeof raw !== 'string') throw new Error('Unknown release surface or missing version');
  const version = raw.startsWith(prefix) ? raw.slice(prefix.length) : raw.startsWith('v') ? raw.slice(1) : raw;
  if (!versionPattern.test(version)) throw new Error(`Invalid ${surface} release version: ${raw}`);
  return version;
}

// Read the remote refs every time. Local tags can be stale, and annotated tags
// must be peeled to commits rather than compared using their tag object IDs.
export function verifyReleaseSource(surface, { cwd = process.cwd(), env = process.env, run = command, requireSelectedTag = env.GITHUB_EVENT_NAME === 'push' } = {}) {
  const raw = env.GITHUB_EVENT_NAME === 'push' ? env.GITHUB_REF_NAME : env.RELEASE_INPUT_VERSION;
  if (!['push', 'workflow_dispatch'].includes(env.GITHUB_EVENT_NAME)) throw new Error('Unsupported release event');
  const version = releaseVersion(surface, raw);
  const tag = `${prefixes[surface]}${version}`;
  if (env.GITHUB_EVENT_NAME === 'push' && env.GITHUB_REF_NAME !== tag) throw new Error('Push did not select this release tag');
  if (!shaPattern.test(env.GITHUB_SHA ?? '')) throw new Error('Exact GITHUB_SHA is required');
  if (!/^[\w.-]+\/[\w.-]+$/.test(env.GITHUB_REPOSITORY ?? '')) throw new Error('GITHUB_REPOSITORY is required');
  const revision = run('git', ['rev-parse', 'HEAD^{commit}'], { cwd, env });
  if (revision !== env.GITHUB_SHA) throw new Error(`Checkout/source mismatch: HEAD ${revision}, event ${env.GITHUB_SHA}`);
  if (env.RELEASE_SOURCE_SHA && env.RELEASE_SOURCE_SHA !== revision) throw new Error('Source changed after the pre-build gate');
  const manifest = JSON.parse(readFileSync(path.join(cwd, 'package.json'), 'utf8'));
  if (manifest.version !== version) throw new Error(`Version mismatch: package.json ${manifest.version}, tag ${tag}`);
  const tags = Object.values(prefixes).map(prefix => `${prefix}${version}`);
  const refs = tags.flatMap(value => [`refs/tags/${value}`, `refs/tags/${value}^{}`]);
  const output = run('git', ['ls-remote', '--tags', 'origin', ...refs], { cwd, env });
  const remote = new Map();
  for (const line of output.split(/\r?\n/).filter(Boolean)) {
    const [sha, ref, extra] = line.split(/\s+/);
    if (!shaPattern.test(sha) || !refs.includes(ref) || extra || remote.has(ref)) throw new Error('Invalid remote tag response');
    remote.set(ref, sha);
  }
  const selectedTagExists = remote.has(`refs/tags/${tag}`);
  if ((requireSelectedTag || env.GITHUB_EVENT_NAME === 'push') && !selectedTagExists) throw new Error(`Required release tag is missing: ${tag}`);
  for (const peer of tags) {
    const ref = `refs/tags/${peer}`;
    if (!remote.has(ref)) continue; // The three products may still be released sequentially.
    const commit = remote.get(`${ref}^{}`) ?? remote.get(ref);
    if (commit !== revision) throw new Error(`Release source mismatch: ${peer} resolves to ${commit}, checkout is ${revision}`);
  }
  return { schemaVersion: 1, repository: env.GITHUB_REPOSITORY, surface, version, tag, revision, selectedTagExists };
}

export function releaseEnvironment(source) {
  const values = { RELEASE_VERSION: source.version, RELEASE_TAG: source.tag, RELEASE_SOURCE_SHA: source.revision };
  if (source.surface === 'vsix') values.RELEASE_TITLE = `Cartridge System ${source.tag}`;
  if (source.surface === 'desktop') Object.assign(values, {
    DESKTOP_RELEASE_VERSION: source.version, DESKTOP_RELEASE_TAG: source.tag,
    DESKTOP_RELEASE_TITLE: `Cartridge Desktop Console ${source.tag}`,
  });
  if (source.surface === 'npm') Object.assign(values, { PUBLISH_VERSION: source.version, PUBLISH_TAG: source.tag });
  return Object.entries(values).map(([key, value]) => `${key}=${value}\n`).join('');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let source = verifyReleaseSource(process.argv[2]);
  await verifyPublishedNpmSource(source);
  source = verifyReleaseSource(process.argv[2]); // Recheck refs after the network read.
  if (process.argv.includes('--write-env')) {
    if (!process.env.GITHUB_ENV) throw new Error('GITHUB_ENV is required');
    appendFileSync(process.env.GITHUB_ENV, releaseEnvironment(source), 'utf8');
  }
  console.log(JSON.stringify(source));
}
