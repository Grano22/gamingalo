import { Command, InvalidArgumentError } from 'commander';
import { channelSchema, semverSchema, type Channel } from '@gamingalo/contracts';
import * as commands from './commands';
import type { Runtime } from './commands';

function channel(value: string): Channel {
  const parsed = channelSchema.safeParse(value);
  if (!parsed.success) throw new InvalidArgumentError('Use production or preview.');
  return parsed.data;
}

function version(value: string): string {
  if (!semverSchema.safeParse(value).success) throw new InvalidArgumentError('Use a semantic version such as 1.0.0.');
  return value;
}

/** Builds the CLI. `runtime` lets tests run commands without a real terminal or network. */
export function createProgram(runtime: Runtime): Command {
  const program = new Command()
    .name('gamingalo')
    .description('Publish and manage Gamingalo games.')
    .version(__CLI_VERSION__)
    .showHelpAfterError();
  const dir = (command: Command) => command.option('-C, --dir <path>', 'the folder with gamingalo.json', '.');

  program
    .command('login')
    .description('Save an API token from your creator settings')
    .option('--token-stdin', 'read the token from standard input')
    .option('--token <token>', 'the token itself (can end up in shell history)')
    .option('--api-url <url>', 'the web services address')
    .action((options) => commands.login(runtime, options));

  program.command('logout').description('Remove the saved token from this computer').action(() => commands.logout(runtime));

  dir(program.command('game:create').description('Register the game in gamingalo.json')).action((options) =>
    commands.createGame(runtime, options.dir),
  );

  dir(program.command('game:keys:create').description('Create and register a signing key for the game')).action((options) =>
    commands.createKey(runtime, options.dir),
  );

  dir(program.command('game:validate').description('Check gamingalo.json, files and budgets without publishing')).action(
    async (options) => {
      if (!(await commands.validate(runtime, options.dir))) process.exitCode = 1;
    },
  );

  dir(
    program
      .command('game:publish')
      .description('Sign, upload and make the game live')
      .option('--channel <channel>', 'production or preview', channel, 'production'),
  ).action((options) => commands.publish(runtime, options.dir, { channel: options.channel }));

  dir(program.command('game:versions').description('List uploaded versions')).action((options) =>
    commands.listVersions(runtime, options.dir),
  );

  dir(
    program
      .command('game:promote')
      .description('Make a version live on a channel')
      .argument('<version>', 'the version', version)
      .option('--channel <channel>', 'production or preview', channel, 'production'),
  ).action((value, options) => commands.promote(runtime, options.dir, value, options.channel));

  dir(
    program.command('game:rollback').description('Make an earlier version live in production').argument('<version>', 'the version', version),
  ).action((value, options) => commands.promote(runtime, options.dir, value, 'production'));

  return program;
}
