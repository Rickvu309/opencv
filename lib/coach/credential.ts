/**
 * The demo account's credential, and the check for whether one is needed.
 *
 * ## Why the app has to ask
 *
 * `agent/channels/eve.ts` guards the agent with HTTP Basic, and a browser will
 * never answer that challenge on its own: the native login dialog only appears
 * for top-level navigations, not for `fetch`. A 401 on a fetch is just a failed
 * request. So the `WWW-Authenticate` header eve sends is real and useless to
 * us, and the app collects the credential itself.
 *
 * ## Why it is stored, not held in memory
 *
 * State already survives a reload (`lib/actions/persistence.ts`). A Coach that
 * demanded the password again on every refresh would be the one part of the app
 * that forgets, which reads as broken rather than secure. This is a shared demo
 * credential printed on the sign-in screen, so storing it protects nothing that
 * is not already public.
 *
 * It is typed by the user at runtime. It never comes from an env var the client
 * can read, never ships in the bundle, and is never written to a tracked file.
 */

const KEY = "openpath:coach-credential:v1";

/** The `Authorization` value, or null when nothing is stored. */
export function loadCredential(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function saveCredential(username: string, password: string): string {
  // btoa handles Latin-1 only, and the demo username is an email address, but
  // a user could type anything into the field. Encode to UTF-8 bytes first so a
  // Vietnamese password produces a valid header instead of throwing.
  const bytes = new TextEncoder().encode(`${username}:${password}`);
  const header = `Basic ${btoa(String.fromCharCode(...bytes))}`;
  try {
    window.localStorage.setItem(KEY, header);
  } catch {
    // Private mode. The credential still works for this tab; it just will not
    // outlive it, which is the same bargain persistence.ts makes.
  }
  return header;
}

export function clearCredential(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Nothing to do.
  }
}

/**
 * Does this credential open the agent?
 *
 * Streams a session id that cannot exist. Route auth runs before the session is
 * looked up, so the status answers the only question we are asking, and no
 * model call is billed either way. Verified against production: 401 with a bad
 * credential, 200 with a good one.
 *
 * Returns "open" when no credential is needed at all, which is the local case:
 * `localDev()` accepts loopback, so a dev session must not be asked to sign in.
 */
export async function checkAccess(
  credential: string | null,
  signal?: AbortSignal,
): Promise<"open" | "locked" | "unreachable"> {
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  signal?.addEventListener("abort", onAbort, { once: true });
  // A probe with no deadline is a hang waiting to happen, and this one sits in
  // the path that recovers from hangs: the turn watchdog asks this question
  // before deciding between the front door and the offline fallback. Measured
  // in exactly that state, a black-holed network left the probe pending and the
  // user watched the typing indicator forever, after the watchdog had already
  // fired correctly. Unanswered is "unreachable".
  const deadline = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch("/eve/v1/session/probe-access/stream", {
      headers: credential ? { authorization: credential } : undefined,
      signal: controller.signal,
    });
    // Nothing is read from the body; the status is the whole answer. Cancel so
    // the connection does not stay open for a session that does not exist.
    void response.body?.cancel();
    return response.status === 401 ? "locked" : "open";
  } catch {
    // Offline, or the agent is down. Not a credential problem, and treating it
    // as one would put a sign-in screen in front of someone whose password is
    // fine.
    return "unreachable";
  } finally {
    clearTimeout(deadline);
    // Free the listener; the request is settled either way.
    signal?.removeEventListener("abort", onAbort);
    controller.abort();
  }
}
