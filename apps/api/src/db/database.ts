/** What the service needs from a database, so that slices don't depend on a specific driver. */
export interface Queryable {
  query<Row = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: Row[] }>;
}

export interface Database extends Queryable {
  /** Runs `action` in a transaction on one connection. It rolls back if `action` throws. */
  transaction<T>(action: (tx: Queryable) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

export async function createDatabase(databaseUrl: string | undefined): Promise<Database> {
  if (databaseUrl) {
    const { createPostgresDatabase } = await import('./postgres');
    return createPostgresDatabase(databaseUrl);
  }
  const { createPgliteDatabase } = await import('./pglite');
  return createPgliteDatabase();
}
