import { NextResponse } from "next/server";

import { currentAccount } from "@/lib/auth/dal";
import { failure, readBody } from "@/lib/auth/http";
import {
  markOutcome,
  recentTraces,
  recentViolations,
  recordTrace,
} from "@/lib/trace/store";
import { isOutcome, looksLikeTrace } from "@/lib/trace/types";

/**
 * The sink's front door.
 *
 * `POST` takes a finished turn, or news that the user undid one. `GET` hands
 * back what has been collected. Both are scoped to the session's own account,
 * the same rule every other endpoint here follows: there is no account id in
 * the URL and none in the body, so there is no value a caller can send that
 * makes this touch somebody else's rows.
 *
 * A cross-account operator view would need an admin role, which does not exist
 * in this product yet and is not part of this work order.
 */

/** Generous for a trace with a dozen spans; a brake, not a budget. */
const MAX_BYTES = 200_000;

export async function GET() {
  const account = await currentAccount();
  if (!account) return failure("no-session", 401);

  try {
    const [traces, violations] = await Promise.all([
      recentTraces(account.id),
      recentViolations(account.id),
    ]);
    return NextResponse.json({ ok: true, traces, violations });
  } catch (error) {
    console.error("trace: read failed", error);
    return failure("store-down", 502);
  }
}

export async function POST(request: Request) {
  const account = await currentAccount();
  if (!account) return failure("no-session", 401);

  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_BYTES) return failure("too-large", 413);

  const body = await readBody(request);
  if (!body) return failure("bad-request", 400);

  try {
    // The later, smaller message: the user pressed undo on a turn already
    // stored. Checked first because it is the common one.
    if (typeof body.traceId === "string" && isOutcome(body.outcome)) {
      const changed = await markOutcome(body.traceId, body.outcome, account.id);
      return NextResponse.json({ ok: changed });
    }

    // The browser is not a thing the server gets to trust. A body that is not
    // a trace is dropped here rather than stored, because the reader would
    // otherwise be handed a row it cannot make sense of.
    if (!looksLikeTrace(body.trace)) return failure("bad-trace", 400);

    // The account comes from the session, never from the body.
    await recordTrace({ ...body.trace, accountId: account.id });
    return NextResponse.json({ ok: true });
  } catch (error) {
    // Losing a trace is not worth telling the user about, but it is worth a
    // line in the log: a sink that has quietly stopped receiving looks exactly
    // like a product with no problems.
    console.error("trace: write failed", error);
    return failure("store-down", 502);
  }
}
