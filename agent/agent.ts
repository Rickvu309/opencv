import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { defineAgent } from "eve";

/**
 * build.nvidia.com — OpenAI-compatible endpoint.
 * Key lives in NVIDIA_API_KEY (.env.local). Server-side only.
 */
const nvidia = createOpenAICompatible({
  name: "nvidia",
  baseURL: "https://integrate.api.nvidia.com/v1",
  apiKey: process.env.NVIDIA_API_KEY ?? "",
});

/**
 * Measured on the current NVIDIA key (see agent-native.md §4):
 *
 *   deepseek-v4-pro     correct, warm Vietnamese, but ~150s per turn in eve
 *   mistral-nemotron    ~4s, but Vietnamese breaks under the English harness prompt
 *   deepseek-v4-flash   intermittently 529 Overloaded
 *   llama-3.3-70b       hangs, returns nothing
 *   nemotron-super-49b  reasoning model, content = null
 *
 * Chose deepseek-v4-pro: correct beats fast. Latency is unresolved — swapping
 * the model is a one-line change here once a better provider is available.
 */
export default defineAgent({
  model: nvidia("deepseek-ai/deepseek-v4-pro"),
  // eve resolves the context window via the AI Gateway catalog; a custom provider
  // model is not listed, so declare it or default compaction fails to compile.
  modelContextWindowTokens: 128_000,
  limits: {
    // A coaching turn is short. Hard-cap so a runaway loop cannot bill us.
    maxInputTokensPerSession: 120_000,
    maxOutputTokensPerSession: 12_000,
    sessionTimeoutMs: 7 * 24 * 60 * 60 * 1_000,
  },
  // No `compaction` block: the limits above already bound the session.
});
