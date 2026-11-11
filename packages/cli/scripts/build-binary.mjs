// Builds a standalone `gamingalo` binary for the current platform with Node's single executable
// applications. CI runs it on each platform, and attaches the results to cli releases.
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const dist = new URL('../dist-sea/', import.meta.url).pathname;
const name = process.platform === 'win32' ? 'gamingalo.exe' : 'gamingalo';
const config = `${dist}sea-config.json`;
writeFileSync(
  config,
  JSON.stringify({
    main: `${dist}gamingalo.cjs`,
    output: `${dist}${name}`,
    disableExperimentalSEAWarning: true,
    useCodeCache: false,
    useSnapshot: false,
  }),
);
execFileSync(process.execPath, ['--build-sea', config], { stdio: 'inherit' });
// macOS refuses to run a modified binary until it's signed again. An ad hoc signature is enough.
if (process.platform === 'darwin') execFileSync('codesign', ['--sign', '-', '--force', `${dist}${name}`], { stdio: 'inherit' });
console.log(`Built ${dist}${name}`);
