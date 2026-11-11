// npm run changelog:check | changelog:rotate | changelog:notes -- <module> <version>
import { checkModule, extractNotes, findModule, listModules, rotateModule } from './changelog-lib.mjs';

const root = new URL('..', import.meta.url).pathname;
const [command, ...args] = process.argv.slice(2);

if (command === 'check') {
  const problems = listModules(root).flatMap(checkModule);
  if (problems.length > 0) {
    console.error(problems.join('\n'));
    process.exit(1);
  }
  console.log(`Changelogs are valid for ${listModules(root).length} modules.`);
} else if (command === 'rotate') {
  for (const module of listModules(root)) {
    const archive = rotateModule(module);
    if (archive) console.log(`${module.id}: moved older versions to changelogs/${archive}`);
  }
} else if (command === 'notes') {
  const [id, version] = args;
  if (!id || !version) throw new Error('Usage: changelog.mjs notes <module> <version>');
  process.stdout.write(`${extractNotes(findModule(root, id), version)}\n`);
} else {
  console.error('Usage: changelog.mjs check | rotate | notes <module> <version>');
  process.exit(1);
}
