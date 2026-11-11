/**
 * Every format that is stored or exchanged carries an integer version, so that a later version of
 * the platform, CLI or SDK can tell exactly what it's reading, and migrate it one step at a time.
 * Bump a format's version for any change older readers can't handle, and add a migration step.
 */
export const FORMAT_VERSIONS = Object.freeze({
  /** `gamingalo.json`. */
  gameConfig: 1,
  /** The manifest the CLI signs and uploads. */
  manifest: 1,
  /** What the SDK keeps in the player's browser. */
  sdkStorage: 1,
  /** The web services' API, also in the path as `/v1`. */
  api: 1,
});
export type FormatName = keyof typeof FORMAT_VERSIONS;

export interface MigrationStep {
  /** Converts a value from version `n` to `n + 1`. Must not depend on anything but its input. */
  up(value: unknown): unknown;
  /** Converts a value from version `n + 1` back to `n`, where that's possible without losing data. */
  down?(value: unknown): unknown;
}

export class MigrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MigrationError';
  }
}

export interface MigrationChain {
  readonly format: string;
  readonly current: number;
  /** Converts a value between two versions, one step at a time, in either direction. */
  migrate(value: unknown, from: number, to?: number): unknown;
  /** The versions this chain can convert between, from oldest to newest. */
  supported(): readonly number[];
}

/**
 * Steps are keyed by the version they start from: `{ 1: step }` goes between 1 and 2. The same
 * input always gives the same output, and the input is never changed.
 */
export function createMigrationChain(
  format: string,
  current: number,
  steps: Readonly<Record<number, MigrationStep>> = {},
): MigrationChain {
  const assertVersion = (version: number, name: string) => {
    if (!Number.isInteger(version) || version < 1) throw new MigrationError(`${format}: ${name} must be a positive whole number.`);
    if (version > current) {
      throw new MigrationError(`${format}: version ${version} is newer than this tool supports (${current}). Update it first.`);
    }
  };
  const stepAt = (version: number) => (Object.hasOwn(steps, version) ? steps[version] : undefined);

  return Object.freeze({
    format,
    current,
    migrate(value: unknown, from: number, to = current) {
      assertVersion(from, 'from');
      assertVersion(to, 'to');
      let result: unknown = structuredClone(value);
      for (let version = from; version < to; version++) {
        const step = stepAt(version);
        if (!step) throw new MigrationError(`${format}: there is no migration from version ${version} to ${version + 1}.`);
        result = step.up(result);
      }
      for (let version = from; version > to; version--) {
        const down = stepAt(version - 1)?.down;
        if (!down) throw new MigrationError(`${format}: version ${version} can't be converted back to ${version - 1}.`);
        result = down(result);
      }
      return result;
    },
    supported() {
      let oldest = current;
      while (oldest > 1 && stepAt(oldest - 1)) oldest--;
      return Object.freeze(Array.from({ length: current - oldest + 1 }, (_, index) => oldest + index));
    },
  });
}

/** Reads a format version from a value, treating a missing one as version 1, the first release. */
export function readFormatVersion(value: unknown, field: string): number {
  if (typeof value !== 'object' || value === null || !Object.hasOwn(value, field)) return 1;
  const version = (value as Record<string, unknown>)[field];
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    throw new MigrationError(`${field} must be a positive whole number.`);
  }
  return version;
}
