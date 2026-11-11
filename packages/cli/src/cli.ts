import { CliError } from './errors';
import { createProgram } from './program';

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString('utf8');
}

// A function rather than top-level await, so the same code also builds as a standalone binary.
async function main(): Promise<void> {
  const program = createProgram({
    env: process.env,
    fetch,
    readStdin,
    output: {
      info: (message) => console.log(message),
      warn: (message) => console.error(message),
    },
  });
  try {
    await program.parseAsync(process.argv);
  } catch (error) {
    if (error instanceof CliError) {
      console.error(`Error: ${error.message}`);
      process.exitCode = 1;
    } else {
      throw error;
    }
  }
}

void main();
