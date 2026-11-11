// Changelog rules for every module (D-31):
// * CHANGELOG.md holds at most MAX_VERSIONS versions, newest first, in Keep a Changelog format.
// * When it has more, every version except the newest moves to
//   changelogs/CHANGELOG.<oldest>.to.<newest>.md, and CHANGELOG.md continues with the newest.
// * The newest version must match package.json, and each version appears once.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const MAX_VERSIONS = 12;
const SECTION = /^## \[([^\]]+)\](.*)$/;
const ARCHIVE = /^CHANGELOG\.(.+)\.to\.(.+)\.md$/;
export const ARCHIVE_NOTE = 'Older versions are in [changelogs/](changelogs/).';

/** Splits a changelog into its header and version sections, newest first as written. */
export function parseChangelog(text) {
  const lines = text.split('\n');
  const header = [];
  const sections = [];
  for (const line of lines) {
    const match = SECTION.exec(line);
    if (match) sections.push({ version: match[1], heading: line, body: [] });
    else if (sections.length === 0) header.push(line);
    else sections[sections.length - 1].body.push(line);
  }
  return {
    header: header.join('\n').trimEnd(),
    sections: sections.map((section) => ({ ...section, body: section.body.join('\n').trim() })),
  };
}

function render(header, sections) {
  const parts = [header.trimEnd(), ...sections.map((section) => `${section.heading}\n\n${section.body}`)];
  return `${parts.join('\n\n')}\n`;
}

function compareVersions(a, b) {
  const parse = (version) => version.split(/[.-]/).map((part) => (/^\d+$/.test(part) ? Number(part) : part));
  const [left, right] = [parse(a), parse(b)];
  for (let index = 0; index < Math.max(left.length, right.length); index++) {
    const [x, y] = [left[index], right[index]];
    if (x === y) continue;
    if (x === undefined) return 1; // 1.0.0 is newer than 1.0.0-beta
    if (y === undefined) return -1;
    if (typeof x === 'number' && typeof y === 'number') return x - y;
    return String(x) < String(y) ? -1 : 1;
  }
  return 0;
}

export function listModules(root) {
  const modules = [];
  for (const group of ['packages', 'apps']) {
    const dir = join(root, group);
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir).sort()) {
      const packageFile = join(dir, name, 'package.json');
      if (!existsSync(packageFile)) continue;
      const pkg = JSON.parse(readFileSync(packageFile, 'utf8'));
      modules.push({ id: name, dir: join(dir, name), name: pkg.name, version: pkg.version, private: pkg.private === true });
    }
  }
  return modules;
}

export function findModule(root, idOrName) {
  const module = listModules(root).find((candidate) => candidate.id === idOrName || candidate.name === idOrName);
  if (!module) throw new Error(`There is no module called ${idOrName}.`);
  return module;
}

export function checkModule(module) {
  const problems = [];
  const file = join(module.dir, 'CHANGELOG.md');
  if (!existsSync(file)) return [`${module.id}: CHANGELOG.md is missing.`];
  if (!existsSync(join(module.dir, 'changelogs'))) problems.push(`${module.id}: the changelogs/ folder is missing.`);

  const { sections } = parseChangelog(readFileSync(file, 'utf8'));
  if (sections.length === 0) problems.push(`${module.id}: CHANGELOG.md has no versions.`);
  if (sections.length > MAX_VERSIONS) {
    problems.push(`${module.id}: CHANGELOG.md has ${sections.length} versions, more than ${MAX_VERSIONS}. Run npm run changelog:rotate.`);
  }
  if (sections[0] && sections[0].version !== module.version) {
    problems.push(`${module.id}: the newest changelog version is ${sections[0].version}, but package.json says ${module.version}.`);
  }
  for (let index = 1; index < sections.length; index++) {
    if (compareVersions(sections[index - 1].version, sections[index].version) <= 0) {
      problems.push(`${module.id}: ${sections[index - 1].version} must be newer than the ${sections[index].version} below it.`);
    }
  }
  for (const section of sections) {
    if (!section.body) problems.push(`${module.id}: ${section.version} has no notes.`);
  }

  const seen = new Set(sections.map((section) => section.version));
  for (const archive of listArchives(module)) {
    const match = ARCHIVE.exec(archive);
    if (!match) {
      problems.push(`${module.id}: changelogs/${archive} isn't named CHANGELOG.<from>.to.<to>.md.`);
      continue;
    }
    const archived = parseChangelog(readFileSync(join(module.dir, 'changelogs', archive), 'utf8')).sections;
    const versions = archived.map((section) => section.version);
    if (versions[versions.length - 1] !== match[1] || versions[0] !== match[2]) {
      problems.push(`${module.id}: changelogs/${archive} should cover ${match[1]} to ${match[2]}, but has ${versions.at(-1)} to ${versions[0]}.`);
    }
    for (const version of versions) {
      if (seen.has(version)) problems.push(`${module.id}: ${version} appears in more than one changelog.`);
      seen.add(version);
    }
  }
  return problems;
}

function listArchives(module) {
  const dir = join(module.dir, 'changelogs');
  return existsSync(dir) ? readdirSync(dir).filter((name) => name.endsWith('.md') && name !== 'README.md').sort() : [];
}

/** Moves every version except the newest out of CHANGELOG.md once it has more than MAX_VERSIONS. */
export function rotateModule(module) {
  const file = join(module.dir, 'CHANGELOG.md');
  const { header, sections } = parseChangelog(readFileSync(file, 'utf8'));
  if (sections.length <= MAX_VERSIONS) return undefined;

  const [newest, ...older] = sections;
  const from = older[older.length - 1].version;
  const to = older[0].version;
  const archiveName = `CHANGELOG.${from}.to.${to}.md`;
  const archivePath = join(module.dir, 'changelogs', archiveName);
  if (existsSync(archivePath)) throw new Error(`${module.id}: changelogs/${archiveName} already exists.`);

  mkdirSync(join(module.dir, 'changelogs'), { recursive: true });
  writeFileSync(archivePath, render(`# Changelog: ${module.name} ${from} to ${to}\n\nArchived from CHANGELOG.md. Newer versions are in [../CHANGELOG.md](../CHANGELOG.md).`, older));
  const nextHeader = header.includes(ARCHIVE_NOTE) ? header : `${header}\n\n${ARCHIVE_NOTE}`;
  writeFileSync(file, render(nextHeader, [newest]));
  return archiveName;
}

/** The notes for one version, from CHANGELOG.md or an archive, for a GitHub release. */
export function extractNotes(module, version) {
  const files = [join(module.dir, 'CHANGELOG.md'), ...listArchives(module).map((name) => join(module.dir, 'changelogs', name))];
  for (const file of files) {
    if (!existsSync(file)) continue;
    const section = parseChangelog(readFileSync(file, 'utf8')).sections.find((candidate) => candidate.version === version);
    if (section) return section.body;
  }
  throw new Error(`${module.id}: there is no changelog entry for ${version}.`);
}
