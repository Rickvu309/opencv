#!/usr/bin/env node
/**
 * Local development: Vite for the app, eve on its own port, proxied same-origin.
 *
 * Production already runs the Coach as a sibling. Dev used to hide that behind
 * Next's `withEve`. Keeping one topology means the proxy is the thing we test.
 */

import { spawn } from "node:child_process";

const evePort = process.env.EVE_DEV_PORT ?? "2000";
const eveOrigin = `http://127.0.0.1:${evePort}`;

const eve = spawn(
  "npx",
  ["eve", "dev", "--port", evePort, "--host", "127.0.0.1", "--no-ui"],
  { stdio: "inherit", env: process.env },
);

const vite = spawn("npx", ["vite", "dev"], {
  stdio: "inherit",
  env: { ...process.env, EVE_DEV_ORIGIN: eveOrigin },
});

function shutdown(code) {
  eve.kill();
  vite.kill();
  process.exit(code ?? 0);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
vite.on("exit", (code) => shutdown(code ?? 0));
eve.on("exit", (code) => {
  if (code) shutdown(code);
});
