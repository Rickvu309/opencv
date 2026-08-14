import { checkEmail, problemCode } from "@/lib/waitlist/email";
import { join, type WaitlistSource } from "@/lib/waitlist/store";

/**
 * The waiting list endpoint.
 *
 * This is the only input OpenPath accepts from an unauthenticated stranger, so
 * it is a real trust boundary and treated as one: nothing from the client is
 * believed, including the client's own validation.
 *
 * Failures answer with a stable `code`, never a sentence. The server has no way
 * to know whether this browser reads Vietnamese or English, and a server that
 * guesses gets it wrong for exactly the people this form exists to reach.
 */

/** How many submissions one address family gets before we stop listening. */
const MAX_PER_WINDOW = 5;
const WINDOW_MS = 60_000;

/**
 * A crude in-memory throttle, and honest about what it is.
 *
 * It resets on cold start and is per-instance, so it is not a real rate limit;
 * it is a brake on the obvious case of one script hammering the form. A real
 * limit needs shared state, which is a bigger decision than a waiting list
 * deserves today. An open POST on a public page with no brake at all is the
 * thing worth avoiding.
 */
const recent = new Map<string, { count: number; resetAt: number }>();

function throttled(key: string): boolean {
  const now = Date.now();
  const seen = recent.get(key);
  if (!seen || now > seen.resetAt) {
    recent.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  seen.count += 1;
  return seen.count > MAX_PER_WINDOW;
}

function isSource(value: unknown): value is WaitlistSource {
  return value === "landing" || value === "end-of-demo";
}

export async function POST(request: Request) {
  // The store is the whole feature. Without it a success response would be a
  // lie, and the person's address would be gone.
  if (!process.env.DATABASE_URL) {
    console.error("waitlist: DATABASE_URL is not set");
    return Response.json({ ok: false, code: "store-down" }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, code: "bad-request" }, { status: 400 });
  }

  const { email, source } = (body ?? {}) as Record<string, unknown>;
  if (typeof email !== "string") {
    return Response.json({ ok: false, code: "bad-request" }, { status: 400 });
  }

  // Server-side validation runs whether or not the client bothered.
  const problem = checkEmail(email);
  if (problem) {
    return Response.json({ ok: false, code: problemCode(problem) }, { status: 400 });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (throttled(ip)) {
    return Response.json({ ok: false, code: "rate-limited" }, { status: 429 });
  }

  try {
    await join(email, isSource(source) ? source : "landing");
  } catch (error) {
    // Never report success for an address that did not land. Log without the
    // address: a failed write is an operational problem, not a reason to put
    // someone's email in a log line.
    console.error("waitlist: write failed", error);
    return Response.json({ ok: false, code: "store-down" }, { status: 502 });
  }

  // Deliberately the same response whether or not this created a row. Saying
  // "you are already on the list" would confirm membership to anyone who can
  // type an address, and it is a small unkindness to someone who forgot.
  return Response.json({ ok: true });
}
