import pg from 'pg';
import type { Database } from './database';

export function createPostgresDatabase(connectionString: string): Database {
  const pool = new pg.Pool({ connectionString });
  return {
    query: async <Row>(sql: string, params: unknown[] = []) => {
      const result = await pool.query(sql, params);
      return { rows: result.rows as Row[] };
    },
    // With no parameters, `pg` uses the simple protocol, which allows several statements.
    exec: async (sql) => void (await pool.query(sql)),
    transaction: async (action) => {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await action({
          query: async <Row>(sql: string, params: unknown[] = []) => {
            const response = await client.query(sql, params);
            return { rows: response.rows as Row[] };
          },
          exec: async (sql) => void (await client.query(sql)),
        });
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
    close: () => pool.end(),
  };
}
