
import { timingSafeEqual } from "node:crypto";

import { failure } from "@/lib/auth/http";
import { runDue } from "@/lib/jobs/runner";
import { WORKFLOWS, scheduleDue } from "@/lib/jobs/workflows";

/**
 * The heartbeat: schedule what is due, then run some of it.
 *
 * Called by Vercel Cron, once a day: this account is on the Hobby plan, which
 * allows one run per day, and an hourly schedule is rejected when the
 * deployment is created rather than when it runs. Both things that happen here
 * are idempotent, so the schedule can also fire late, twice, or from two
 * regions at once without anybody getting two of anything.
 *
 * The constraint costs retry latency rather than correctness: a job that fails
 * backs off and then waits for tomorrow. Both current jobs are a daily sweep
 * and a weekly nudge, so neither notices.
 *
 * The schedule itself lives in `vercel.json`, which takes no comments: its cron
 * entries reject any key outside the schema, `//` included. So the reasoning is
 * here, next to the handler it explains.
 *
 * ## Why this is not open
 *
 * It runs background work, so an unauthenticated caller could spin the queue.
 * `CRON_SECRET` is the standard bearer token Vercel Cron sends; without it set,
 * the endpoint refuses rather than defaulting to open, because an endpoint that
 * is open when misconfigured is open on the day it matters.
 */

/** Bounded: a cron request has a deadline, and a queue can outgrow one run. */
const PER_RUN = 10;

function authorised(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  if (header.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(header), Buffer.from(expected));
}

export async function GET(request: Request) {
  if (!authorised(request)) return failure("no-session", 401);

  try {
    await scheduleDue();
    const result = await runDue(WORKFLOWS, PER_RUN);
    return Response.json({ ok: true, ...result });
  } catch (error) {
    // A failed heartbeat is worth a line, and worth a non-200 so the platform's
    // own cron log shows it rather than reporting a healthy schedule.
    console.error("cron: run failed", error);
    return failure("store-down", 502);
  }
}
