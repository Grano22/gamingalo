import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Database } from './database';
import { migrate } from './migrate';
import { createPgliteDatabase } from './pglite';

describe('migrate', () => {
  let database: Database;

  beforeEach(async () => {
    database = await createPgliteDatabase();
  });

  afterEach(async () => {
    await database.close();
  });

  const tableExists = async (name: string) =>
    (await database.query('SELECT 1 FROM information_schema.tables WHERE table_name = $1', [name])).rows.length > 0;

  it('applies migrations in order, once only', async () => {
    const list = [
      { id: '001', sql: 'CREATE TABLE a (id INT)' },
      { id: '002', sql: 'ALTER TABLE a ADD COLUMN b INT' },
    ];

    expect(await migrate(database, list)).toEqual(['001', '002']);
    expect(await migrate(database, list)).toEqual([]);
    await database.query('SELECT b FROM a');
  });

  it('applies only new migrations later', async () => {
    await migrate(database, [{ id: '001', sql: 'CREATE TABLE a (id INT)' }]);
    const applied = await migrate(database, [
      { id: '001', sql: 'CREATE TABLE a (id INT)' },
      { id: '002', sql: 'CREATE TABLE c (id INT)' },
    ]);
    expect(applied).toEqual(['002']);
  });

  it('applies a migration with several statements', async () => {
    await migrate(database, [{ id: '001', sql: 'CREATE TABLE a (id INT); CREATE TABLE b (id INT);' }]);
    expect(await tableExists('a')).toBe(true);
    expect(await tableExists('b')).toBe(true);
  });

  it('rolls everything back when one fails, and can run again after a fix', async () => {
    const good = { id: '001', sql: 'CREATE TABLE a (id INT)' };

    await expect(migrate(database, [good, { id: '002', sql: 'NOT VALID SQL' }])).rejects.toThrow();
    expect(await tableExists('a')).toBe(false);

    expect(await migrate(database, [good])).toEqual(['001']);
    expect(await tableExists('a')).toBe(true);
  });
});
