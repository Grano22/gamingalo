// Copies each module's CHANGELOG.md into the docs, so the site always shows current release notes.
// Safe to run at the same time as another sync: files are replaced whole, only when they change,
// and only pages for modules that no longer exist are removed.
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('../../../', import.meta.url).pathname;
const target = new URL('../content/docs/changelogs/', import.meta.url).pathname;
mkdirSync(target, { recursive: true });

const pages = new Map();
for (const group of ['packages', 'apps']) {
  for (const id of readdirSync(join(root, group)).sort()) {
    const changelog = join(root, group, id, 'CHANGELOG.md');
    if (!existsSync(changelog)) continue;
    const { name } = JSON.parse(readFileSync(join(root, group, id, 'package.json'), 'utf8'));
    // The page title replaces the file's own heading, and links to archives point at GitHub.
    const body = readFileSync(changelog, 'utf8')
      .replace(/^# .*\n/, '')
      .replaceAll('](changelogs/)', `](https://github.com/Grano22/gamingalo/tree/master/${group}/${id}/changelogs)`);
    // JSON strings are valid YAML, so names such as @gamingalo/sdk need no further escaping.
    const frontmatter = `title: ${JSON.stringify(name)}\ndescription: ${JSON.stringify(`Release notes for ${name}.`)}`;
    pages.set(`${id}.md`, `---\n${frontmatter}\n---\n${body}`);
  }
}

for (const [file, content] of pages) {
  const path = join(target, file);
  if (existsSync(path) && readFileSync(path, 'utf8') === content) continue;
  const temporary = `${path}.${process.pid}.tmp`;
  writeFileSync(temporary, content);
  renameSync(temporary, path);
}
for (const file of readdirSync(target)) {
  if (file.endsWith('.md') && !pages.has(file)) rmSync(join(target, file), { force: true });
}
console.log(`Synced ${pages.size} changelogs into the docs.`);
