import type { Migration } from './migrate';

/** Add new migrations at the end. Never edit one that has been applied. */
export const migrations: readonly Migration[] = [];
