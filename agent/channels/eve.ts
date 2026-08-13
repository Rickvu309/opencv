import { eveChannel } from "eve/channels/eve";
import {
  httpBasic,
  localDev,
  vercelOidc,
  type AuthFn,
} from "eve/channels/auth";

/**
 * The demo credential, as HTTP Basic.
 *
 * There is one shared demo account this phase, so the whole tenancy story is a
 * username and a password. `httpBasic` compares them in constant time, so this
 * is not a hand-rolled string check.
 *
 * Resolved per request rather than at module scope on purpose: both `eve build`
 * and `next build` import this file, and a throw at import time would break a
 * build machine that has no reason to hold the credential.
 *
 * Fails closed. With nothing configured this authenticator declines and the
 * walk falls through to a 401, rather than opening the endpoint. An agent left
 * open is billed in model tokens by whoever finds it.
 */
function demoAccount(): AuthFn<Request> {
  return (request) => {
    const username = process.env.OPENPATH_DEMO_USER;
    const password = process.env.OPENPATH_DEMO_PASSWORD;
    if (!username || !password) return null;
    return httpBasic({ username, password }, { realm: "OpenPath" })(request);
  };
}

export default eveChannel({
  auth: [
    // Vercel-to-Vercel callers and the eve TUI against a Vercel deployment.
    // Inert once the agent moves to Railway; harmless to leave in the walk.
    vercelOidc(),
    // `eve dev`, the REPL and `next dev`. Localhost only; ignored in production.
    localDev(),
    demoAccount(),
  ],
});
