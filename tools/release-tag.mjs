// npm run release:tag -- <module>
// Checks that a module is ready to release, then creates its tag locally. Pushing the tag starts
// the release workflow, so that stays a deliberate, separate step.
import { execFileSync } from 'node:child_process';
import { checkModule, extractNotes, findModule } from './changelog-lib.mjs';

const root = new URL('..', import.meta.url).pathname;
const module = findModule(root, process.argv[2] ?? '');
const problems = checkModule(module);
if (problems.length > 0) throw new Error(problems.join('\n'));
extractNotes(module, module.version);

const status = execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' });
if (status.trim()) throw new Error('Commit or stash your changes first, so the tag matches what was tested.');

const tag = `${module.id}-v${module.version}`;
execFileSync('git', ['tag', '-a', tag, '-m', `${module.name} ${module.version}`], { cwd: root, stdio: 'inherit' });
console.log(`Created ${tag}. Push it to release: git push origin ${tag}`);
