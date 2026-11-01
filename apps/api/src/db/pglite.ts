import { PGlite } from '@electric-sql/pglite';
import type { Database } from './database';

/** PostgreSQL compiled to WebAssembly and held in memory. For development and tests only. */
export async function createPgliteDatabase(): Promise<Database> {
  const database = await PGlite.create();
  return {
    query: async <Row>(sql: string, params: unknown[] = []) => {
      const result = await database.query<Row>(sql, params);
      return { rows: result.rows };
    },
    transaction: async (action) => {
      const result = await database.transaction((tx) =>
        action({
          query: async <Row>(sql: string, params: unknown[] = []) => {
            const response = await tx.query<Row>(sql, params);
            return { rows: response.rows };
          },
        }),
      );
      return result as Awaited<ReturnType<typeof action>>;
    },
    close: () => database.close(),
  };
}
