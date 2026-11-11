import { createHash } from 'node:crypto';
import { lstat, readdir, readFile } from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';
import { filePathSchema, parseGameConfig, type GameConfig, type Manifest, FORMAT_VERSIONS } from '@gamingalo/contracts';
import { CliError } from './errors';

export interface ProjectFile {
  path: string;
  absolutePath: string;
  size: number;
  sha256: string;
}

export interface Project {
  root: string;
  config: GameConfig;
  files: ProjectFile[];
  /** Files left out, such as `.DS_Store`, with the reason. */
  skipped: string[];
  totalBytes: number;
}

export interface ValidationResult {
  problems: string[];
}

async function readConfig(root: string): Promise<GameConfig> {
  let raw: unknown;
  try {
    raw = JSON.parse(await readFile(join(root, 'gamingalo.json'), 'utf8'));
  } catch (error) {
    throw new CliError(`Could not read gamingalo.json in ${root}: ${(error as Error).message}`);
  }
  try {
    return parseGameConfig(raw);
  } catch (error) {
    const issues = (error as { issues?: Array<{ path: PropertyKey[]; message: string }> }).issues;
    const details = issues ? issues.map((issue) => `${issue.path.join('.') || 'file'}: ${issue.message}`).join('; ') : (error as Error).message;
    throw new CliError(`gamingalo.json is not valid. ${details}`);
  }
}

/** Lists every file under `dir`. Symbolic links are refused, so nothing outside the folder can be published. */
async function walk(dir: string, root: string, found: string[], skipped: string[], problems: string[]): Promise<void> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const absolute = join(dir, entry.name);
    const path = relative(root, absolute).split(sep).join('/');
    if (entry.name.startsWith('.')) {
      skipped.push(`${path} (hidden)`);
      continue;
    }
    const info = await lstat(absolute);
    if (info.isSymbolicLink()) problems.push(`${path}: symbolic links can't be published`);
    else if (info.isDirectory()) await walk(absolute, root, found, skipped, problems);
    else if (info.isFile()) found.push(absolute);
  }
}

export async function loadProject(directory: string): Promise<Project & ValidationResult> {
  const root = resolve(directory);
  const config = await readConfig(root);
  const publishRoot = resolve(root, config.dir);
  if (publishRoot !== root && !publishRoot.startsWith(root + sep)) {
    throw new CliError(`"dir" must be inside the project folder.`);
  }

  const problems: string[] = [];
  const skipped: string[] = [];
  const absolutePaths: string[] = [];
  try {
    await walk(publishRoot, publishRoot, absolutePaths, skipped, problems);
  } catch (error) {
    throw new CliError(`Could not read ${config.dir}: ${(error as Error).message}`);
  }

  const files: ProjectFile[] = [];
  for (const absolutePath of absolutePaths.sort()) {
    const path = relative(publishRoot, absolutePath).split(sep).join('/');
    const check = filePathSchema.safeParse(path);
    if (!check.success) {
      problems.push(`${path}: ${check.error.issues[0]?.message ?? 'not allowed'}`);
      continue;
    }
    const content = await readFile(absolutePath);
    files.push({ path, absolutePath, size: content.length, sha256: createHash('sha256').update(content).digest('hex') });
  }

  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
  const budgets = config.budgets ?? {};
  if (!files.some((file) => file.path === config.entry)) problems.push(`The entry file ${config.entry} is missing from ${config.dir}.`);
  if (files.length === 0) problems.push(`${config.dir} has no files to publish.`);
  if (budgets.maxFiles !== undefined && files.length > budgets.maxFiles) {
    problems.push(`Budget: ${files.length} files, but maxFiles is ${budgets.maxFiles}.`);
  }
  if (budgets.maxTotalBytes !== undefined && totalBytes > budgets.maxTotalBytes) {
    problems.push(`Budget: ${totalBytes} bytes in total, but maxTotalBytes is ${budgets.maxTotalBytes}.`);
  }
  for (const file of files) {
    if (budgets.maxFileBytes !== undefined && file.size > budgets.maxFileBytes) {
      problems.push(`Budget: ${file.path} is ${file.size} bytes, but maxFileBytes is ${budgets.maxFileBytes}.`);
    }
  }
  return { root, config, files, skipped, totalBytes, problems };
}

export function buildManifest(project: Project): Manifest {
  return {
    formatVersion: FORMAT_VERSIONS.manifest,
    gameId: project.config.id,
    version: project.config.version,
    entry: project.config.entry,
    files: project.files.map(({ path, size, sha256 }) => ({ path, size, sha256 })),
  };
}
