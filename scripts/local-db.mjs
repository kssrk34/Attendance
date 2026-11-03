// Starts a throwaway local PostgreSQL server for development and tests.
// Usage: npm run db:local   (keep it running in its own terminal)
// Connection string: postgresql://postgres:postgres@localhost:5433/attendance
import fs from "node:fs";
import path from "node:path";
import EmbeddedPostgres from "embedded-postgres";

const dataDir = path.resolve(".pgdata");
const isNew = !fs.existsSync(path.join(dataDir, "PG_VERSION"));

const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: "postgres",
  password: "postgres",
  port: 5433,
  persistent: true,
});

if (isNew) await pg.initialise();
await pg.start();
try {
  await pg.createDatabase("attendance");
} catch {
  // database already exists
}
console.log("Local Postgres running: postgresql://postgres:postgres@localhost:5433/attendance");
console.log("Press Ctrl+C to stop.");

const stop = async () => {
  await pg.stop();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
setInterval(() => {}, 1 << 30);
