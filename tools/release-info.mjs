// Reads a release tag such as `sdk-v0.14.0`, checks it against the module, and prints
// key=value lines for GitHub Actions outputs.
import { findModule } from './changelog-lib.mjs';

export function parseReleaseTag(tag) {
  const match = /^([a-z0-9-]+)-v(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)$/.exec(tag);
  if (!match) throw new Error(`${tag} isn't a release tag. Use <module>-v<version>, such as sdk-v0.14.0.`);
  return { module: match[1], version: match[2] };
}

export function releaseInfo(root, tag) {
  const { module: id, version } = parseReleaseTag(tag);
  const module = findModule(root, id);
  if (module.version !== version) {
    throw new Error(`${tag} says ${version}, but ${module.name} is ${module.version} in package.json.`);
  }
  return {
    module: module.id,
    name: module.name,
    version,
    dir: module.dir.slice(root.length).replace(/^\/+/, ''),
    publish: String(!module.private),
    prerelease: String(version.includes('-')),
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const root = new URL('..', import.meta.url).pathname;
  for (const [key, value] of Object.entries(releaseInfo(root, process.argv[2] ?? ''))) console.log(`${key}=${value}`);
}
