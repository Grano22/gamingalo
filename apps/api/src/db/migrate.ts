import type { Database } from './database';

export interface Migration {
  /** Unique and never changed once applied. Applied in the order listed. */
  id: string;
  sql: string;
}

/** Any fixed number works, as long as this service alone uses it for locking. */
const MIGRATION_LOCK = 7246190;

/**
 * Applies pending migrations in order, in one transaction, under a lock, so that instances
 * starting together don't conflict. Any failure rolls everything back and rethrows.
 */
export async function migrate(database: Database, migrations: readonly Migration[]): Promise<string[]> {
  return database.transaction(async (tx) => {
    await tx.query('SELECT pg_advisory_xact_lock($1)', [MIGRATION_LOCK]);
    await tx.query(
      'CREATE TABLE IF NOT EXISTS schema_migrations (id TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())',
    );
    const { rows } = await tx.query<{ id: string }>('SELECT id FROM schema_migrations');
    const applied = new Set(rows.map((row) => row.id));
    const newlyApplied: string[] = [];

    for (const migration of migrations) {
      if (applied.has(migration.id)) continue;
      await tx.query(migration.sql);
      await tx.query('INSERT INTO schema_migrations (id) VALUES ($1)', [migration.id]);
      newlyApplied.push(migration.id);
    }
    return newlyApplied;
  });
}
