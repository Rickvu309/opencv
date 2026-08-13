import * as React from "react";

/**
 * Whether the agent will talk to us, and what to do when it will not.
 *
 * ## What changed
 *
 * This used to collect a shared demo password, keep it in localStorage, and put
 * it on an `Authorization` header. The agent is now guarded by the session
 * cookie, which the browser attaches to a same-origin request without being
 * asked, so there is no credential to collect, store, or go stale. The module
 * that held it is gone.
 *
 * ## Why the probe survived the migration
 *
 * Because the distinction it draws still matters, and is still not visible from
 * an error. A turn that fails has failed for one of two reasons, and they call
 * for opposite responses:
 *
 * - **Locked.** The session expired or was signed out elsewhere. The answer is
 *   the sign-in page. Sending this person to the offline fallback would leave
 *   them talking to canned replies forever, blaming a service that is fine.
 * - **Offline.** The agent is down, or the network is. The answer is the
 *   fallback. Sending this person to a sign-in form would ask them to fix a
 *   password that was never wrong.
 *
 * `useEveAgent`'s error carries no status, so the only way to tell is to ask
 * again and read the status. The probe costs no model call, which is what makes
 * that affordable on every failure.
 */

export type CoachAccess = "checking" | "open" | "locked";

/**
 * Does the agent accept this browser's session?
 *
 * Streams a session id that cannot exist. Route auth runs before the session is
 * looked up, so the status answers the only question being asked, and no model
 * call is billed either way.
 *
 * Returns "open" when nothing is required at all, which is the local case:
 * `localDev()` accepts loopback, so a dev session is not asked to sign in.
 */
export async function probeAccess(
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
      // The cookie is `httpOnly`, so this is the only way the request can carry
      // it, and it is the default for same-origin. Said out loud because a
      // probe that quietly went out unauthenticated would report "locked" for
      // everybody.
      credentials: "same-origin",
      signal: controller.signal,
    });
    // Nothing is read from the body; the status is the whole answer. Cancel so
    // the connection does not stay open for a session that does not exist.
    void response.body?.cancel();
    return response.status === 401 ? "locked" : "open";
  } catch {
    // Offline, or the agent is down. Not a session problem, and treating it as
    // one would put a sign-in page in front of someone whose session is fine.
    return "unreachable";
  } finally {
    clearTimeout(deadline);
    // Free the listener; the request is settled either way.
    signal?.removeEventListener("abort", onAbort);
    controller.abort();
  }
}

/**
 * The agent's door, watched.
 *
 * Checked once on mount with a request that costs no model call, so a locked
 * door is known before the user types rather than after their first question
 * is thrown away.
 */
export function useCoachAccess() {
  const [access, setAccess] = React.useState<CoachAccess>("checking");

  React.useEffect(() => {
    const controller = new AbortController();
    void probeAccess(controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      // "unreachable" is not "locked": the agent being down must not put a
      // sign-in page in front of someone whose session is fine. Let the turn
      // fail and take the offline path instead.
      setAccess(result === "locked" ? "locked" : "open");
    });
    return () => controller.abort();
  }, []);

  /**
   * A 401 arrived on a live turn: the session is over. There is nothing to
   * evict, because nothing is stored any more; the cookie is the server's to
   * invalidate and it already has.
   */
  const lock = React.useCallback(() => setAccess("locked"), []);

  return { access, lock };
}
