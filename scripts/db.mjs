// The database command line: apply migrations, undo the last one, or look.
//
//   npm run db:migrate     apply everything pending
//   npm run db:rollback    undo the most recent migration
//   npm run db:status      show what is applied and what is not
//
// Run against whatever `DATABASE_URL` points at, which `--env-file-if-exists`
// takes from `.env.local`. There is no flag to pick a database: a command that
// can be aimed is a command that gets aimed at the wrong one.

import pg from "pg";

import { connectionConfig, databaseUrl, schemaName } from "../src/lib/db/client.ts";
import { migrateDown, migrateUp, migrationStatus } from "../src/lib/db/migrate.ts";

const command = process.argv[2] ?? "status";

/** Which host, without the password. Printed so nobody migrates blind. */
function describe(url) {
  try {
    const { hostname, port, pathname } = new URL(url);
    return `${hostname}:${port}${pathname}`;
  } catch {
    return "(unparseable DATABASE_URL)";
  }
}

async function main() {
  const url = databaseUrl();
  const schema = schemaName();
  console.log(`database ${describe(url)}  schema ${schema}`);

  // A single connection, not the app's pool: the advisory lock and the
  // `search_path` both belong to one session, and a pool would hand the second
  // statement to a different one.
  const client = new pg.Client(connectionConfig(url, schema));
  await client.connect();

  try {
    if (command === "up" || command === "migrate") {
      const ran = await migrateUp(client, { schema });
      console.log(ran.length ? `applied ${ran.join(", ")}` : "nothing to apply");
      return;
    }

    if (command === "down" || command === "rollback") {
      const id = await migrateDown(client, { schema });
      console.log(id ? `rolled back ${id}` : "nothing to roll back");
      return;
    }

    if (command === "status") {
      const rows = await migrationStatus(client, { schema });
      for (const row of rows) {
        const when = row.appliedAt
          ? row.appliedAt.toISOString().slice(0, 19).replace("T", " ")
          : "pending";
        console.log(
          `  ${row.id}_${row.name.padEnd(20)} ${when}${row.changed ? "  EDITED SINCE APPLIED" : ""}`,
        );
      }
      return;
    }

    throw new Error(`Unknown command ${JSON.stringify(command)}. Use up, down or status.`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
