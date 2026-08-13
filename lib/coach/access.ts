import * as React from "react";

import type { Locale } from "@/lib/i18n/locale";
import { messages } from "@/lib/i18n/messages";

import {
  checkAccess,
  clearCredential,
  loadCredential,
  saveCredential,
} from "./credential";

/**
 * Whether the agent will talk to us at all, and the sign-in flow that opens
 * the door. Checked once on mount with a request that costs no model call,
 * so a locked door is known before the user types rather than after their
 * first question is thrown away.
 *
 * `credential` is exposed as a ref rather than state: `headers()` on the eve
 * client reads it synchronously on every request, and re-rendering the whole
 * thread on a credential change it does not otherwise care about would be
 * the wrong cost for the wrong reason.
 */
export function useCoachAccess(locale: Locale) {
  const [access, setAccess] = React.useState<"checking" | "open" | "locked">(
    "checking",
  );
  const [signingIn, setSigningIn] = React.useState(false);
  const [signInError, setSignInError] = React.useState<string | null>(null);
  const credential = React.useRef<string | null>(null);

  React.useEffect(() => {
    const controller = new AbortController();
    credential.current = loadCredential();
    void checkAccess(credential.current, controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      // "unreachable" is not "locked": the agent being down must not put a
      // sign-in screen in front of someone whose password is fine. Let the
      // turn fail and take the offline path instead.
      if (result === "locked") {
        // Drop a credential the server has already rejected, so nothing can
        // send it again and a reload starts from a clean slate.
        clearCredential();
        credential.current = null;
        setAccess("locked");
        return;
      }
      setAccess("open");
    });
    return () => controller.abort();
  }, []);

  const signIn = React.useCallback((username: string, password: string) => {
    if (!username || !password) {
      setSignInError(messages.coach.signInMissingFields[locale]);
      return;
    }
    setSigningIn(true);
    setSignInError(null);
    const header = saveCredential(username, password);
    void checkAccess(header).then((result) => {
      setSigningIn(false);
      if (result === "open") {
        credential.current = header;
        setAccess("open");
        return;
      }
      // Wrong credential: drop it so a reload does not resurrect a password
      // already known to fail.
      clearCredential();
      credential.current = null;
      setSignInError(
        result === "locked"
          ? messages.coach.signInWrong[locale]
          : messages.coach.signInUnreachable[locale],
      );
    });
  }, [locale]);

  /**
   * A 401 arrived on a live turn: the credential is stale, evict it and show
   * the door. `message` is optional because the mount check has nothing to
   * say yet, it is only ever wrong after the user has tried something.
   */
  const lock = React.useCallback((message?: string) => {
    clearCredential();
    credential.current = null;
    setAccess("locked");
    if (message) setSignInError(message);
  }, []);

  return { access, signingIn, signInError, signIn, credential, lock };
}
