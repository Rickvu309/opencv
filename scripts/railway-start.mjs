#!/usr/bin/env node
/**
 * Pair of `scripts/railway-build.mjs`. The agent is a Nitro server; the web
 * app is the Vite/Nitro output. Cron rides with the web process: Railway is a
 * long-lived Node, the jobs are idempotent, and a second service whose only
 * job is to hit this one would be a second thing to keep alive.
 */

import { spawn, spawnSync } from "node:child_process";

const service = process.env.RAILWAY_SERVICE_NAME ?? "";

if (service === "openpath-agent") {
  const result = spawnSync("npx", ["eve", "start", "--host", "0.0.0.0"], {
    stdio: "inherit",
    env: process.env,
  });
  process.exit(result.status ?? 1);
}

const app = spawn("npm", ["start"], { stdio: "inherit", env: process.env });

function runCron() {
  spawn(
    process.execPath,
    ["--import", "./scripts/alias-hook.mjs", "scripts/cron-once.mjs"],
    { stdio: "inherit", env: process.env },
  );
}

// First pass after boot, then hourly. The jobs key themselves by day and ISO
// week, so firing twice or late is a no-op rather than a duplicate.
const HOUR = 60 * 60 * 1000;
setTimeout(runCron, 20_000);
setInterval(runCron, HOUR);

app.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
