import { currentAccount } from "@/lib/auth/dal";
import { failure, readBody } from "@/lib/auth/http";
import { looksLikeState, readAccountState, writeAccountState } from "@/lib/state/account-state.server";

/**
 * The signed-in account's state: read it, or replace it.
 *
 * ## Why the account comes from the session and never from the request
 *
 * There is no account id in the URL and none in the body. The only account
 * this endpoint will act on is the one the session resolves to, so there is no
 * value a caller can send that makes it touch somebody else's row. That is
 * AC-ACCT-004.2 and AC-ACCT-004.4 enforced by shape rather than by a check
 * somebody has to remember to write.
 */

/** About a thousand times the size of a real state. A brake, not a budget. */
const MAX_BYTES = 1_000_000;

export async function GET() {
  const account = await currentAccount();
  if (!account) return failure("no-session", 401);

  try {
    const state = await readAccountState(account.id);
    return Response.json({ ok: true, state });
  } catch (error) {
    console.error("state: read failed", error);
    return failure("store-down", 502);
  }
}

/**
 * The same write, under the only verb `navigator.sendBeacon` can use.
 *
 * A tab being closed cancels outstanding `fetch` calls, and the beacon is the
 * one thing the browser promises to deliver anyway. It posts. So this exists,
 * pointing at the same handler, rather than the last few seconds of somebody's
 * work being lost every time they close the tab.
 */
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

  // The client's own validation is not evidence. A body that is not an
  // `AppState` must never reach the row, because the next read hands it to a
  // reducer that will assume it is one.
  if (!looksLikeState(body.state)) return failure("bad-state", 400);

  try {
    await writeAccountState(account.id, body.state);
    return Response.json({ ok: true });
  } catch (error) {
    // Never report a save that did not land. The client warns the user that it
    // has stopped remembering, which is the only honest thing to say.
    console.error("state: write failed", error);
    return failure("store-down", 502);
  }
}
