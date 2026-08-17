import { migrate } from "../src/core/db/migrate.ts";
import { spawn } from "node:child_process";

await migrate("up");
const child = spawn("node", [".output/server/index.mjs"], {
  stdio: "inherit",
  env: process.env,
});
child.on("exit", (code) => process.exit(code ?? 0));
