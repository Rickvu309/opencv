import { defineTool } from "eve/tools";
import { z } from "zod";

import { actionNames, actions, lookupAction } from "../../lib/actions/registry";

/**
 * The Coach's hands.
 *
 * Every change the app can make to itself is registered in lib/actions/registry
 * — the same registry the UI dispatches through. This tool exposes that set to
 * the model, validates the payload against the action's own schema, and returns
 * an envelope the client applies. The agent never mutates state directly, so a
 * malformed call fails here instead of corrupting the app.
 */
const catalog = actionNames
  .map((name) => `- ${name}: ${actions[name].description}`)
  .join("\n");

export default defineTool({
  description:
    "Make a change in the OpenPath app on the user's behalf. Available actions:\n" +
    catalog +
    "\n\nOnly call this when the user has agreed to the change. Describe what " +
    "you did afterwards in one short Vietnamese sentence.",
  inputSchema: z.object({
    action: z.enum(actionNames as [string, ...string[]]),
    input: z
      .record(z.string(), z.unknown())
      .default({})
      .describe("Payload matching the chosen action's schema"),
  }),
  async execute({ action, input }) {
    const definition = lookupAction(action);
    if (!definition) {
      return { ok: false as const, error: `Unknown action "${action}"` };
    }
    // Validate here so the model gets a correctable error, not a silent no-op.
    const parsed = definition.input.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false as const,
        error: `Invalid input for ${action}: ${parsed.error.message}`,
      };
    }
    return {
      ok: true as const,
      action,
      input: parsed.data,
      summary: definition.summary(parsed.data as never),
    };
  },
});
