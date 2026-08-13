import { defineTool } from "eve/tools";
import { z } from "zod";

import {
  actionNames,
  actions,
  isDestructiveAction,
  lookupAction,
} from "../../lib/actions/registry";

/**
 * The Coach's hands.
 *
 * Every change the app can make to itself is registered in lib/actions/registry
 *, the same registry the UI dispatches through. This tool exposes that set to
 * the model, validates the payload against the action's own schema, and returns
 * an envelope the client applies. The agent never mutates state directly, so a
 * malformed call fails here instead of corrupting the app.
 */
/**
 * The fields an action takes, as a signature the model can copy.
 *
 * Without this the catalogue named every action and described what each one was
 * *for*, while `input` was documented only as "payload matching the chosen
 * action's schema", a schema the model was never shown. So it guessed the field
 * names. Measured, on an action since retired: asked to add a task it sent
 * `input:{content:"học SQL cơ bản"}` where the schema wanted `title`, and the
 * call failed. The model does not know what it does not know, so it read the
 * failure as bad luck and gave up rather than trying the other name.
 *
 * Required fields first, optional ones marked, no types: the names are what was
 * missing, and a full JSON Schema for every action would cost more context than
 * it buys.
 */
function signature(schema: unknown): string {
  const shape =
    schema && typeof schema === "object" && "shape" in schema
      ? (schema as { shape: Record<string, { isOptional?: () => boolean }> })
          .shape
      : undefined;
  if (!shape) return "";

  const fields = Object.entries(shape).map(([field, type]) => {
    // Optional and defaulted fields both answer true; both are fields the
    // caller may leave out, which is the only distinction that matters here.
    const optional = type?.isOptional?.() === true;
    return optional ? `${field}?` : field;
  });

  return fields.length > 0 ? `(${fields.join(", ")})` : "()";
}

const catalog = actionNames
  .map(
    (name) =>
      `- ${name}${signature(actions[name].input)}: ${actions[name].description}` +
      (isDestructiveAction(name) ? " [asks the user first]" : ""),
  )
  .join("\n");

export default defineTool({
  description:
    "Make a change in the OpenPath app on the user's behalf. Available actions:\n" +
    catalog +
    // The previous wording here was "Only call this when the user has agreed to
    // the change", which read as "check first" even when the user's message was
    // itself the instruction. Measured: the model answered "I've added it to
    // your task list" having never called this tool, and the list stayed empty.
    "\n\nA direct request from the user IS their agreement: call this straight " +
    "away rather than asking them to confirm. Ask first only when you would " +
    "have to guess something that matters, or when the change would discard " +
    "work they already have.\n\n" +
    "Nothing changes until this call returns successfully. Never tell the user " +
    "you have added, updated or created something unless you called this and " +
    "it succeeded. Afterwards, say what you did in one short sentence, in the " +
    "user's language; the app shows its own confirmation and undo, so do not " +
    "repeat the details.",
  inputSchema: z.object({
    action: z.enum(actionNames as [string, ...string[]]),
    input: z
      .record(z.string(), z.unknown())
      .default({})
      .describe("Payload matching the chosen action's schema"),
  }),
  /**
   * Ask before destroying anything; apply everything else on sight.
   *
   * Per call rather than per tool, because one tool covers every
   * actions and the answer differs by which one. `toolInput` carries the
   * arguments the model chose, so the decision is made against the actual
   * action rather than against the tool's name.
   *
   * The asymmetry is deliberate. Adds and edits stay automatic: the product's
   * promise is a coach that operates the app for you, and a confirmation on
   * every edit is exactly the friction that promise removes — `dispatch`
   * already announces each change and offers undo. Undo is enough for a wrong
   * edit. It is not enough for a wrong *deletion*, because the toast that
   * carries it leaves after a few seconds and the content does not come back.
   */
  approval: ({ toolInput }) =>
    isDestructiveAction(String(toolInput?.action ?? ""))
      ? "user-approval"
      : "not-applicable",
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
