import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { defineAgent } from "eve";

/**
 * OpenRouter, OpenAI-compatible endpoint.
 *
 * Key lives in OPENROUTER_API_KEY (.env.local), server-side only, and is never
 * read by anything the browser can reach. Replaces build.nvidia.com direct.
 */
const openrouter = createOpenAICompatible({
  name: "openrouter",
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
  // OpenRouter attributes traffic by these; harmless elsewhere.
  headers: {
    "HTTP-Referer": "https://openpath-app.vercel.app",
    "X-Title": "OpenPath",
  },
  // eve exposes no sampling settings and `providerOptions` is a closed schema
  // that strips unknown keys, so this hook is the documented escape hatch.
  transformRequestBody: (body) => ({
    ...body,
    // Kept from the previous provider, where temperature 1.0 dropped
    // CJK/Hangul/Cyrillic tokens into Vietnamese in 4 of 6 replies and 0.3 cut
    // it to roughly none. Cheap insurance on a new model until proven
    // unnecessary; watch real threads for stray scripts.
    temperature: 0.3,
    top_p: 0.95,
  }),
});

/**
 * The model, overridable without a code change.
 *
 * Both of these were probed against the real tool schema on 2026-08-12 before
 * being wired in:
 *
 *   deepseek/deepseek-v4-flash-0731         tool call in  2s
 *   nvidia/nemotron-3-ultra-550b-a55b:free  tool call in  9s
 *
 * Both returned `{"action":"todo.add","input":{"title":"học SQL cơ bản"}}` —
 * the right action and, notably, the right *field name*, which the previous
 * model only managed after the tool catalogue was taught to publish its
 * signatures.
 */
const MODEL =
  process.env.OPENPATH_MODEL ?? "deepseek/deepseek-v4-flash-0731";

/**
 * ## Why `chat_template_kwargs` is gone
 *
 * The previous model — nemotron-3-super via NVIDIA direct — could not call
 * tools at all unless `enable_thinking: true` was passed to its chat template.
 * With it off it answered "Tôi đã thêm việc đó vào danh sách" having called
 * nothing, which is the one failure this product cannot absorb: every screen
 * the Coach edits is a screen the user then trusts without checking. Turning it
 * on fixed correctness and cost a bare greeting 52 seconds.
 *
 * The note left there said that if the latency became the thing that sank the
 * product, the fix was a provider that could call tools without reasoning
 * first, not another round of prompt. That is what this is. Both models above
 * call tools with no such knob, so the knob is gone rather than carried over as
 * a superstition — it was nemotron-super-specific and means nothing to
 * DeepSeek.
 *
 * The stop button in the composer stays. It was built for a 52-second turn and
 * is merely uneventful at two, and a hung turn is a hung turn on any provider.
 */
export default defineAgent({
  model: openrouter(MODEL),
  // eve resolves the context window via the AI Gateway catalog and a custom
  // provider model is not listed, so it has to be declared or compaction cannot
  // size itself. Both candidates report ~1M; declaring the smaller of the two
  // keeps this honest if `OPENPATH_MODEL` switches underneath it.
  modelContextWindowTokens: 1_000_000,
  limits: {
    // A coaching turn is short. Hard-cap so a runaway loop cannot bill us.
    // Unchanged from the previous provider despite the far larger window: the
    // cap exists to bound cost and conversation length, not to fill the model.
    maxInputTokensPerSession: 120_000,
    maxOutputTokensPerSession: 12_000,
    sessionTimeoutMs: 7 * 24 * 60 * 60 * 1_000,
  },
  // No `compaction` block: the limits above already bound the session.
});
