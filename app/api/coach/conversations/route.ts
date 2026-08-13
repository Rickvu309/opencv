import { NextResponse } from "next/server";

import { currentAccount } from "@/lib/auth/dal";
import { failure, readBody } from "@/lib/auth/http";
import { readConversations, writeConversations } from "@/lib/coach/account-conversations";

/**
 * The signed-in account's Coach threads.
 *
 * The account comes from the session and from nowhere else, exactly as in
 * `app/api/state/route.ts`, so there is no value a caller can send that makes
 * this touch somebody else's threads. AC-ACCT-004.2 and AC-ACCT-004.4 hold by
 * shape rather than by a check somebody has to remember to write.
 */

/**
 * Twelve conversations of four hundred stream events each is the cap, and this
 * is a brake far above what that produces. A body larger than this is not a
 * long conversation, it is something else.
 */
const MAX_BYTES = 8_000_000;

export async function GET() {
  const account = await currentAccount();
  if (!account) return failure("no-session", 401);

  try {
    return NextResponse.json({ ok: true, conversations: await readConversations(account.id) });
  } catch (error) {
    console.error("conversations: read failed", error);
    return failure("store-down", 502);
  }
}

/** The verb `navigator.sendBeacon` can use, for the flush as a tab closes. */
export async function POST(request: Request) {
  return PUT(request);
}

export async function PUT(request: Request) {
  const account = await currentAccount();
  if (!account) return failure("no-session", 401);

  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_BYTES) return failure("too-large", 413);

  const body = await readBody(request);
  if (!body) return failure("bad-request", 400);
  if (!Array.isArray(body.conversations)) return failure("bad-request", 400);

  try {
    // The store trims again on the way in. The browser already did, and "the
    // client already did it" is not a property a server can check.
    await writeConversations(account.id, body.conversations);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("conversations: write failed", error);
    return failure("store-down", 502);
  }
}
