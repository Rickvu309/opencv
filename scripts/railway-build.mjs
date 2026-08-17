#!/usr/bin/env node
/**
 * One repo, two Railway services. `railway.json` cannot say two start
 * commands, so the service name decides which build this is.
 *
 * `openpath-agent` is the Coach: `eve build`. Everything else (the web app)
 * is `vite build`. A third service must not silently inherit the agent build.
 */

import { spawnSync } from "node:child_process";

const service = process.env.RAILWAY_SERVICE_NAME ?? "";
const agent = service === "openpath-agent";
const command = agent ? ["npx", "eve", "build"] : ["npm", "run", "build"];

const result = spawnSync(command[0], command.slice(1), {
  stdio: "inherit",
  env: process.env,
});

if (result.error) {
  console.error(result.error);
  process.exit(1);
}
process.exit(result.status ?? 1);
