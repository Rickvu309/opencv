import { NextResponse } from "next/server";

import { currentAccount } from "@/lib/auth/dal";
import { failure, readBody } from "@/lib/auth/http";
import { newId } from "@/lib/trace/collector";
import { recordViolation } from "@/lib/trace/store";
import { truncateSample } from "@/lib/trace/types";

/**
 * Somebody telling us something is wrong.
 *
 * ## Why it lands in the violations table
 *
 * Because that is where "something about the Coach was not right" already
 * lands, and a report from a person is the highest-quality example of exactly
 * that. A separate table would mean two screens to look at and one of them
 * forgotten. The rule is `user-report`, so it filters apart from the guards'
 * own findings.
 */
const MAX_BYTES = 20_000;

export async function POST(request: Request) {
  const account = await currentAccount();
  if (!account) return failure("no-session", 401);

  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_BYTES) return failure("too-large", 413);

  const body = await readBody(request);
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  if (message.length < 5) return failure("bad-request", 400);

  try {
    await recordViolation({
      id: newId(),
      traceId: null,
      accountId: account.id,
      guard: "output",
      rule: "user-report",
      severity: "flag",
      detail: "a user reported a problem",
      sample: truncateSample(message),
      at: Date.now(),
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    // Reported honestly. A confirmation for a report that was lost is worse
    // than an error, because the user waits for a reply nobody will send.
    console.error("support: could not record a report", error);
    return failure("store-down", 502);
  }
}
