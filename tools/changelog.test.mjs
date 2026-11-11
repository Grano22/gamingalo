import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { checkModule, extractNotes, MAX_VERSIONS, parseChangelog, rotateModule } from './changelog-lib.mjs';

function moduleWith(versions, { packageVersion = versions[0], archives = true } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'changelog-'));
  if (archives) mkdirSync(join(dir, 'changelogs'));
  const sections = versions.map((version) => `## [${version}] - 2026-11-11\n\n### Added\n\n* Change in ${version}.`);
  writeFileSync(join(dir, 'CHANGELOG.md'), `# Changelog\n\nAll notable changes.\n\n${sections.join('\n\n')}\n`);
  return { id: 'demo', dir, name: '@gamingalo/demo', version: packageVersion };
}

const versions = (count) => Array.from({ length: count }, (_, index) => `0.${count - index}.0`);

test('accepts a valid changelog', () => {
  assert.deepEqual(checkModule(moduleWith(versions(3))), []);
});

test('reports a version that differs from package.json, bad order and missing folders', () => {
  const problems = checkModule(moduleWith(['0.1.0', '0.2.0'], { packageVersion: '0.3.0', archives: false })).join('\n');
  assert.match(problems, /changelogs\/ folder is missing/);
  assert.match(problems, /newest changelog version is 0.1.0, but package.json says 0.3.0/);
  assert.match(problems, /0.1.0 must be newer than the 0.2.0/);
});

test('orders versions by semver, not as text', () => {
  assert.deepEqual(checkModule(moduleWith(['0.10.0', '0.9.0', '0.8.1', '0.8.0'])), []);
  assert.deepEqual(checkModule(moduleWith(['1.0.0', '1.0.0-beta.2'])), []);
});

test(`asks for rotation above ${MAX_VERSIONS} versions`, () => {
  assert.match(checkModule(moduleWith(versions(MAX_VERSIONS + 1))).join(), /Run npm run changelog:rotate/);
  assert.deepEqual(checkModule(moduleWith(versions(MAX_VERSIONS))), []);
});

test('rotates every version but the newest into a named archive, and stays valid', () => {
  const module = moduleWith(versions(MAX_VERSIONS + 1));
  assert.equal(rotateModule(module), 'CHANGELOG.0.1.0.to.0.12.0.md');

  const current = parseChangelog(readFileSync(join(module.dir, 'CHANGELOG.md'), 'utf8'));
  assert.deepEqual(current.sections.map((section) => section.version), ['0.13.0']);
  assert.match(current.header, /Older versions are in \[changelogs\/\]/);
  assert.deepEqual(readdirSync(join(module.dir, 'changelogs')), ['CHANGELOG.0.1.0.to.0.12.0.md']);
  const archived = parseChangelog(readFileSync(join(module.dir, 'changelogs/CHANGELOG.0.1.0.to.0.12.0.md'), 'utf8'));
  assert.equal(archived.sections.length, MAX_VERSIONS);
  assert.deepEqual(checkModule(module), []);
});

test('does nothing at or below the limit', () => {
  assert.equal(rotateModule(moduleWith(versions(MAX_VERSIONS))), undefined);
});

test('extracts release notes from the changelog or an archive', () => {
  const module = moduleWith(versions(MAX_VERSIONS + 1));
  rotateModule(module);
  assert.equal(extractNotes(module, '0.13.0'), '### Added\n\n* Change in 0.13.0.');
  assert.equal(extractNotes(module, '0.2.0'), '### Added\n\n* Change in 0.2.0.');
  assert.throws(() => extractNotes(module, '9.9.9'), /no changelog entry for 9.9.9/);
});

test('reports a version that appears twice, and a misnamed archive', () => {
  const module = moduleWith(['0.2.0', '0.1.0']);
  writeFileSync(join(module.dir, 'changelogs/CHANGELOG.0.1.0.to.0.1.0.md'), '# Old\n\n## [0.1.0] - 2026-01-01\n\n* Old.\n');
  writeFileSync(join(module.dir, 'changelogs/notes.md'), '# Other\n');
  const problems = checkModule(module).join('\n');
  assert.match(problems, /0.1.0 appears in more than one changelog/);
  assert.match(problems, /notes.md isn't named/);
});

test('refuses a version with no notes', () => {
  const module = moduleWith(['0.1.0']);
  writeFileSync(join(module.dir, 'CHANGELOG.md'), '# Changelog\n\n## [0.1.0] - 2026-11-11\n');
  assert.match(checkModule(module).join(), /0.1.0 has no notes/);
});

test('reads release tags, and refuses others', async () => {
  const { parseReleaseTag } = await import('./release-info.mjs');
  assert.deepEqual(parseReleaseTag('sdk-v0.14.0'), { module: 'sdk', version: '0.14.0' });
  assert.deepEqual(parseReleaseTag('plugin-screen-preferences-v1.0.0-beta.1'), {
    module: 'plugin-screen-preferences',
    version: '1.0.0-beta.1',
  });
  assert.throws(() => parseReleaseTag('v1.0.0'), /isn't a release tag/);
  assert.throws(() => parseReleaseTag('sdk-1.0.0'), /isn't a release tag/);
});

test('matches a tag to the real modules in this repository', async () => {
  const { releaseInfo } = await import('./release-info.mjs');
  const root = new URL('..', import.meta.url).pathname;
  const sdk = JSON.parse(readFileSync(join(root, 'packages/sdk/package.json'), 'utf8'));
  assert.deepEqual(releaseInfo(root, `sdk-v${sdk.version}`), {
    module: 'sdk',
    name: '@gamingalo/sdk',
    version: sdk.version,
    dir: 'packages/sdk',
    publish: 'true',
    prerelease: 'false',
  });
  assert.equal(releaseInfo(root, `api-v${JSON.parse(readFileSync(join(root, 'apps/api/package.json'), 'utf8')).version}`).publish, 'false');
  assert.throws(() => releaseInfo(root, 'sdk-v99.0.0'), /but @gamingalo\/sdk is/);
  assert.throws(() => releaseInfo(root, 'nope-v1.0.0'), /no module called nope/);
});
