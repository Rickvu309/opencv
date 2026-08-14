#!/usr/bin/env node
/**
 * One heartbeat of the job runner: schedule what is due, then run some of it.
 *
 * Used by the web process on Railway, in place of Vercel Cron. Same work as
 * `GET /api/cron`, without an HTTP round trip to ourselves.
 */

import { runDue } from "../lib/jobs/runner.ts";
import { WORKFLOWS, scheduleDue } from "../lib/jobs/workflows.ts";

const PER_RUN = 10;

async function main() {
  await scheduleDue();
  const result = await runDue(WORKFLOWS, PER_RUN);
  console.log("cron:", JSON.stringify({ ok: true, ...result }));
}

main().catch((error) => {
  console.error("cron: run failed", error);
  process.exitCode = 1;
});
