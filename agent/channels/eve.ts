import { eveChannel } from "eve/channels/eve";
import { localDev, vercelOidc } from "eve/channels/auth";

import { userSession } from "./session";

export default eveChannel({
  auth: [
    // Vercel-to-Vercel callers and the eve TUI against a Vercel deployment.
    // Inert once the agent moves to Railway; harmless to leave in the walk.
    vercelOidc(),
    // `eve dev`, the REPL and `next dev`. Localhost only; ignored in production.
    localDev(),
    // The signed-in user. This used to be one shared demo account over HTTP
    // Basic, with its password printed on the form; the turn is now authorized
    // by whoever is actually signed in. See ./session.ts.
    userSession(),
  ],
});
