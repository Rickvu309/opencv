import { defineAgent } from "eve";

import { model, selected } from "../src/lib/ai/gateway";
import { SESSION_CEILINGS } from "../src/lib/ai/router";

/**
 * The Coach's model comes from the gateway, not from this file.
 *
 * Everything that used to live here (the provider, the key, the model id, the
 * sampling defaults) moved to `lib/ai/`. This file now states one thing: a
 * Coach turn is a conversational request. Which model serves it, and what
 * happens when that model is overloaded, is the router's decision, and it is
 * the same decision every other AI call in the product gets.
 *
 * ## Why `chat_template_kwargs` is gone
 *
 * The provider before this one (nemotron-3-super via NVIDIA direct) could not
 * call tools at all unless `enable_thinking: true` was passed to its chat
 * template. With it off it answered "Tôi đã thêm việc đó vào danh sách" having
 * called nothing, which is the one failure this product cannot absorb: every
 * screen the Coach edits is a screen the user then trusts without checking.
 * Turning it on fixed correctness and cost a bare greeting 52 seconds.
 *
 * The note left there said that if the latency became the thing that sank the
 * product, the fix was a provider that could call tools without reasoning
 * first, not another round of prompt. Both models in the registry call tools
 * with no such knob, so the knob is gone rather than carried over as a
 * superstition.
 *
 * The stop button in the composer stays. It was built for a 52-second turn and
 * is merely uneventful at two, and a hung turn is a hung turn on any provider.
 */
const conversational = selected("conversational");

export default defineAgent({
  model: model("conversational"),
  // eve resolves the context window through the AI Gateway catalog, and a
  // custom provider model is not listed there, so it has to be declared or
  // compaction cannot size itself. Taken from the registry entry, so changing
  // the model also changes the window rather than leaving a stale literal.
  modelContextWindowTokens: conversational.contextWindowTokens,
  limits: {
    // The same ceilings the router enforces for non-eve callers. Declared in
    // one place so a session cannot be bounded two different ways depending on
    // which path reached the model.
    maxInputTokensPerSession: SESSION_CEILINGS.inputTokens,
    maxOutputTokensPerSession: SESSION_CEILINGS.outputTokens,
    sessionTimeoutMs: 7 * 24 * 60 * 60 * 1_000,
  },
  // No `compaction` block: the limits above already bound the session.
});
