import EmbeddedPostgres from 'embedded-postgres';
import { mkdir, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const directory = fileURLToPath(new URL('../.local/postgres', import.meta.url));
const port = Number(process.env.CRM_DB_PORT || 55433);
await mkdir(directory, { recursive: true });
const pg = new EmbeddedPostgres({
  databaseDir: directory,
  user: 'crm', password: 'crm_local_only', port,
  persistent: true,
  authMethod: 'scram-sha-256',
  postgresFlags: ['-h', '127.0.0.1', '-k', directory],
});
try { await access(`${directory}/PG_VERSION`); }
catch { await pg.initialise(); }
await pg.start();
const client = pg.getPgClient('postgres', '127.0.0.1');
await client.connect();
const result = await client.query("SELECT 1 FROM pg_database WHERE datname = 'crm'");
if (!result.rowCount) await client.query('CREATE DATABASE crm');
await client.end();
console.log(`\nCRM PostgreSQL is ready on 127.0.0.1:${port}. Press Ctrl+C to stop.\n`);
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  await pg.stop();
  process.exit(0);
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
setInterval(() => {}, 60_000);
