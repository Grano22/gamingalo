/** An error meant for the person running the CLI. Its message is printed as is, with no stack trace. */
export class CliError extends Error {
  constructor(
    message: string,
    readonly code = 'CLI_ERROR',
  ) {
    super(message);
    this.name = 'CliError';
  }
}
