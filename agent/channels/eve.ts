import { eveChannel, defaultEveAuth } from "eve/channels/eve";
import { localDev } from "eve/channels/auth";

import { userSession } from "../../src/lib/auth/agent-session";
import { meterTurn, screenInboundTurn } from "../../src/lib/guardrails/server";

export default eveChannel({
  auth: [
    // `eve dev` and the REPL. Localhost only; ignored in production.
    localDev(),
    // The signed-in user. This used to be one shared demo account over HTTP
    // Basic, with its password printed on the form; the turn is now authorized
    // by whoever is actually signed in. See lib/auth/agent-session.ts.
    userSession(),
  ],

  /**
   * The input guard, where it cannot be skipped.
   *
   * Runs after auth and before dispatch, which is the only point in the turn
   * where a refusal costs nothing: no model call has been made and none will
   * be. The browser screens the same message before sending, so in normal use
   * this never fires. It fires when the browser was not ours.
   *
   * Throwing is the refusal. There is no way to hand a different message on
   * from here, and passing a screened-out message through unchanged would make
   * the guard decorative.
   */
  async onMessage(ctx, message) {
    const accountId = ctx.eve.caller?.principalId ?? null;
    const text = typeof message === "string" ? message : textOf(message);
    if (text) {
      await screenInboundTurn({ text, accountId });
    }
    // After the guard, before the model. A turn refused by the guard should
    // not spend an allowance, and a turn refused for allowance should not have
    // been screened for nothing.
    await meterTurn(accountId);
    return { auth: defaultEveAuth(ctx) };
  },
});

/** The words out of a multi-part message; attachments are not screened here. */
function textOf(content: unknown): string {
  if (!Array.isArray(content)) return "";
  return content
    .filter(
      (part): part is { type: "text"; text: string } =>
        typeof part === "object" &&
        part !== null &&
        (part as { type?: unknown }).type === "text" &&
        typeof (part as { text?: unknown }).text === "string",
    )
    .map((part) => part.text)
    .join("\n");
}
