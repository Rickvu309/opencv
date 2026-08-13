import { NextResponse } from "next/server";

import { currentAccount } from "@/lib/auth/dal";
import { failure, readBody } from "@/lib/auth/http";
import { newId } from "@/lib/trace/collector";
import { recordViolation } from "@/lib/trace/store";
import { truncateSample, type ViolationSeverity } from "@/lib/trace/types";

/**
 * Where the browser's guards report what they caught.
 *
 * Separate from `/api/trace` because a violation arrives at a different moment
 * from the trace it belongs to: the input guard fires before the turn has
 * started, so there is nothing to attach it to yet.
 *
 * This endpoint only records. It has no say in whether anything was refused;
 * that already happened in the browser, and on the server in the eve channel
 * for anything that got past it.
 */

const MAX_BYTES = 50_000;
const SEVERITIES: ViolationSeverity[] = ["block", "revise", "flag"];

type Incoming = {
  rule?: unknown;
  severity?: unknown;
  detail?: unknown;
  sample?: unknown;
};

export async function POST(request: Request) {
  const account = await currentAccount();
  if (!account) return failure("no-session", 401);

  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_BYTES) return failure("too-large", 413);

  const body = await readBody(request);
  if (!body) return failure("bad-request", 400);

  const guard = body.guard === "output" ? "output" : "input";
  const traceId = typeof body.traceId === "string" ? body.traceId : null;
  const findings = Array.isArray(body.findings) ? body.findings : [];
  if (findings.length === 0) return failure("bad-request", 400);

  try {
    for (const raw of findings.slice(0, 20) as Incoming[]) {
      if (typeof raw.rule !== "string" || typeof raw.detail !== "string") continue;
      await recordViolation({
        id: newId(),
        traceId,
        accountId: account.id,
        guard,
        rule: raw.rule,
        severity: SEVERITIES.includes(raw.severity as ViolationSeverity)
          ? (raw.severity as ViolationSeverity)
          : "flag",
        detail: raw.detail,
        sample:
          typeof raw.sample === "string" ? truncateSample(raw.sample) : null,
        at: Date.now(),
      });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("guardrails: write failed", error);
    return failure("store-down", 502);
  }
}
