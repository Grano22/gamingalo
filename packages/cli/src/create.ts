import { execFile } from 'node:child_process';
import { readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { basename, join, resolve, sep } from 'node:path';
import { promisify } from 'node:util';
import { gameIdSchema } from '@gamingalo/contracts';
import * as z from 'zod';
import { CliError } from './errors';

const run = promisify(execFile);

/** Where `gamingalo create` clones from, unless `--template` or GAMINGALO_TEMPLATE says otherwise. */
export const DEFAULT_TEMPLATE = 'https://github.com/gamingalo/game-skeleton.git';

/** `.gamingalo/template.json` in a template repository. */
const templateSchema = z.strictObject({
  formatVersion: z.literal(1),
  placeholders: z.strictObject({ id: z.string().min(1), title: z.string().min(1) }),
  files: z.array(z.string().min(1)),
  remove: z.array(z.string().min(1)),
});

export interface CreateOptions {
  directory: string;
  template: string;
  ref?: string;
  id?: string;
  title?: string;
  git: boolean;
}

/** Turns a folder name into a valid game ID, such as `My Game!` into `my-game`. */
export function suggestGameId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
}

function inside(root: string, path: string): string {
  const absolute = resolve(root, path);
  if (absolute !== root && !absolute.startsWith(root + sep)) throw new CliError(`The template refers to ${path}, outside the project.`);
  return absolute;
}

/**
 * Clones the template, fills in the game's ID and title, removes the template's own files and
 * starts a fresh git history. Nothing from the template's history is kept.
 */
export async function createProject(options: CreateOptions): Promise<{ root: string; id: string; title: string }> {
  const root = resolve(options.directory);
  const id = options.id ?? suggestGameId(basename(root));
  const parsedId = gameIdSchema.safeParse(id);
  if (!parsedId.success) throw new CliError(`"${id}" can't be a game ID. ${parsedId.error.issues[0]?.message ?? ''} Pass --id.`);
  const title = options.title?.trim() || id.split('-').map((word) => word[0]?.toUpperCase() + word.slice(1)).join(' ');

  const existing = await readdir(root).catch(() => undefined);
  if (existing && existing.length > 0) throw new CliError(`${root} already exists and isn't empty.`);
  // Refused, so a template value can never be read by git as an option.
  if (options.template.startsWith('-') || options.ref?.startsWith('-')) throw new CliError('The template and ref must not start with "-".');

  try {
    await run('git', ['clone', '--depth', '1', ...(options.ref ? ['--branch', options.ref] : []), '--', options.template, root]);
  } catch (error) {
    await rm(root, { recursive: true, force: true });
    throw new CliError(`Could not clone the template ${options.template}: ${(error as { stderr?: string }).stderr?.trim() || (error as Error).message}`);
  }

  try {
    await rm(join(root, '.git'), { recursive: true, force: true });
    let template: z.infer<typeof templateSchema>;
    try {
      template = templateSchema.parse(JSON.parse(await readFile(join(root, '.gamingalo/template.json'), 'utf8')));
    } catch (error) {
      throw new CliError(`The template has no valid .gamingalo/template.json: ${(error as Error).message}`);
    }

    for (const file of template.files) {
      const path = inside(root, file);
      const content = await readFile(path, 'utf8');
      // The title first, because the ID can be part of it.
      await writeFile(path, content.split(template.placeholders.title).join(title).split(template.placeholders.id).join(id));
    }
    for (const path of template.remove) await rm(inside(root, path), { recursive: true, force: true });

    if (options.git) {
      await run('git', ['init', '-q', '-b', 'main'], { cwd: root });
    }
  } catch (error) {
    await rm(root, { recursive: true, force: true });
    throw error;
  }
  return { root, id, title };
}
