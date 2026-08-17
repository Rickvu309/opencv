import { migrate } from "../src/core/db/migrate.ts";

const command = process.argv[2] ?? "status";

if (command === "up") await migrate("up");
else if (command === "down") await migrate("down");
else await migrate("status");
