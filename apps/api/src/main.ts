import { buildApp } from './app';
import { loadConfig } from './config';
import { createDatabase } from './db/database';
import { migrate } from './db/migrate';
import { migrations } from './db/migrations';
import { buildGamesApp } from './games-server';
import { runMaintenance } from './maintenance';
import { createFileBlobStore } from './storage/blob-store';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const config = loadConfig();
const database = await createDatabase(config.databaseUrl);
await migrate(database, migrations);

// Outside production, files go to a temporary folder unless STORAGE_DIR is set.
const store = createFileBlobStore(config.storageDir ?? join(tmpdir(), 'gamingalo-storage'));
const app = await buildApp({ config, database, store });
const games = buildGamesApp(config, database, store);

const maintain = async () => {
  try {
    app.log.info(await runMaintenance(database, config.guestRetentionDays), 'maintenance done');
  } catch (error) {
    app.log.error({ err: error }, 'maintenance failed');
  }
};
await maintain();
const maintenanceTimer = setInterval(() => void maintain(), 60 * 60 * 1000);
maintenanceTimer.unref();

let stopping = false;
async function stop(signal: string): Promise<void> {
  if (stopping) return;
  stopping = true;
  app.log.info({ signal }, 'stopping');
  try {
    clearInterval(maintenanceTimer);
    await app.close();
    await games.close();
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
await games.listen({ host: config.host, port: config.gamesPort });
