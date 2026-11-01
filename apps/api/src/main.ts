import { buildApp } from './app';
import { loadConfig } from './config';
import { createDatabase } from './db/database';
import { migrate } from './db/migrate';
import { migrations } from './db/migrations';

const config = loadConfig();
const database = await createDatabase(config.databaseUrl);
await migrate(database, migrations);

const app = await buildApp({ config, database });

let stopping = false;
async function stop(signal: string): Promise<void> {
  if (stopping) return;
  stopping = true;
  app.log.info({ signal }, 'stopping');
  try {
    await app.close();
    await database.close();
    process.exit(0);
  } catch (error) {
    app.log.error({ err: error }, 'failed to stop cleanly');
    process.exit(1);
  }
}
process.on('SIGTERM', () => void stop('SIGTERM'));
process.on('SIGINT', () => void stop('SIGINT'));

await app.listen({ host: config.host, port: config.port });
