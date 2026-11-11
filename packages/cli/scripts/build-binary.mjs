// Builds a standalone `gamingalo` binary for the current platform with Node's single executable
// applications. CI runs it on each platform, and attaches the results to cli releases.
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// fileURLToPath, because URL.pathname gives `/D:/...` on Windows.
const dist = fileURLToPath(new URL('../dist-sea/', import.meta.url));
const name = process.platform === 'win32' ? 'gamingalo.exe' : 'gamingalo';
const config = join(dist, 'sea-config.json');
const output = join(dist, name);
writeFileSync(
  config,
  JSON.stringify({
    main: join(dist, 'gamingalo.cjs'),
    output,
    disableExperimentalSEAWarning: true,
    useCodeCache: false,
    useSnapshot: false,
  }),
);
execFileSync(process.execPath, ['--build-sea', config], { stdio: 'inherit' });
// macOS refuses to run a modified binary until it's signed again. An ad hoc signature is enough.
if (process.platform === 'darwin') execFileSync('codesign', ['--sign', '-', '--force', output], { stdio: 'inherit' });
console.log(`Built ${output}`);
