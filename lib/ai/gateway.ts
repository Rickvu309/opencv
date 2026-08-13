/**
 * The one seam through which OpenPath reaches a language model.
 *
 * Every model call in the product goes through here: the Coach turn, any
 * structured draft, any embedding. No other file constructs a provider, holds
 * the API key, or names a model id, which is what makes switching providers a
 * configuration change instead of a search-and-replace.
 *
 * Server-side only. `OPENROUTER_API_KEY` is read here and nowhere the browser
 * can reach.
 */

import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type {
  LanguageModelV4,
  LanguageModelV4CallOptions,
  LanguageModelV4Middleware,
} from "@ai-sdk/provider";
import {
  APICallError,
  embed as sdkEmbed,
  embedMany as sdkEmbedMany,
  generateObject,
  generateText,
  streamText,
  wrapLanguageModel,
  type LanguageModel,
} from "ai";

import { MODEL_REGISTRY, type ModelRole, type RegisteredModel } from "@/lib/ai/registry";
import { candidates, type RoutingPolicy } from "@/lib/ai/router";
import { costOf } from "@/lib/trace/collector";
import { currentCollector } from "@/lib/trace/current";

/** Where the sampling defaults for a model id are found at request time. */
const SAMPLING_BY_ID = new Map(
  MODEL_REGISTRY.map((model) => [model.id, model.providerOptions.sampling]),
);

/**
 * The provider, built once and lazily.
 *
 * Lazily because importing this module must not require a key: the router and
 * registry tests import the same package graph, and a missing key should fail
 * when a model is actually called, not when a test file loads.
 */
let provider: ReturnType<typeof createOpenAICompatible> | null = null;

function openrouter() {
  if (provider) return provider;
  provider = createOpenAICompatible({
    name: "openrouter",
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_API_KEY,
    // OpenRouter attributes traffic by these; harmless elsewhere.
    headers: {
      "HTTP-Referer": "https://openpath-app.vercel.app",
      "X-Title": "OpenPath",
    },
    // The AI SDK has no per-model sampling channel that survives to an
    // OpenAI-compatible body, so the registry's sampling is applied here,
    // matched on the model id the request is actually carrying. This keeps
    // sampling a property of the model rather than of the provider.
    transformRequestBody: (body) => {
      const sampling = SAMPLING_BY_ID.get(String((body as { model?: unknown }).model));
      return sampling ? { ...body, ...sampling } : body;
    },
  });
  return provider;
}

/** Visible for tests: forget the built provider so a new key is picked up. */
export function resetProvider() {
  provider = null;
}

/**
 * Is this worth trying a different model for?
 *
 * A 400 means the request is wrong and the next model will refuse it in the
 * same way, only slower and for money. Overload, rate limiting and transport
 * failures are the cases a second model actually fixes.
 */
export function isWorthFallingBack(error: unknown): boolean {
  if (APICallError.isInstance(error)) {
    if (error.isRetryable) return true;
    const status = error.statusCode ?? 0;
    return status === 408 || status === 409 || status === 429 || status >= 500;
  }
  // A transport failure never reached a model, so it says nothing about the
  // request being wrong. Worth another provider.
  if (error instanceof Error) {
    return /fetch failed|network|socket|ECONN|ETIMEDOUT|timeout|overload/i.test(
      error.message,
    );
  }
  return false;
}

/**
 * Try each model in turn until one answers.
 *
 * Two rules keep a retried turn from double-applying:
 *
 * 1. Only retryable failures fall back. A rejected request is not retried
 *    against a second model that would reject it identically.
 * 2. A stream that has already started never falls back. Once the user has
 *    seen text, a second model's stream would repeat or contradict it, and any
 *    tool call already emitted would apply twice. `doStream` resolving is the
 *    line: before it, nothing has been delivered and a retry is invisible;
 *    after it, the turn belongs to the model that started it.
 */
export function fallbackMiddleware(
  alternates: LanguageModelV4[],
): LanguageModelV4Middleware {
  return {
    specificationVersion: "v4",

    async wrapGenerate({ doGenerate, params }) {
      try {
        return await doGenerate();
      } catch (error) {
        if (!isWorthFallingBack(error)) throw error;
        return await walk(
          alternates,
          params,
          (candidate, options) => candidate.doGenerate(options),
          error,
        );
      }
    },

    async wrapStream({ doStream, params }) {
      try {
        return await doStream();
      } catch (error) {
        if (!isWorthFallingBack(error)) throw error;
        return await walk(
          alternates,
          params,
          (candidate, options) => candidate.doStream(options),
          error,
        );
      }
    },
  };
}

/** Walk the alternates, returning the first answer or rethrowing the original. */
async function walk<T>(
  alternates: LanguageModelV4[],
  params: LanguageModelV4CallOptions,
  call: (
    candidate: LanguageModelV4,
    options: LanguageModelV4CallOptions,
  ) => PromiseLike<T>,
  original: unknown,
): Promise<T> {
  for (const alternate of alternates) {
    try {
      return await call(alternate, params);
    } catch (error) {
      if (!isWorthFallingBack(error)) throw error;
    }
  }
  throw original;
}

/**
 * Records a span for every model call, when a trace is listening.
 *
 * Wrapped outside the fallback middleware on purpose, so the span covers the
 * whole attempt including any fallback: what a caller waited for is the number
 * worth having, not what the first model spent before giving up.
 *
 * When nothing is listening the call runs untouched. A span with no trace to
 * belong to answers no question, so it is dropped rather than buffered.
 */
function tracingMiddleware(entry: RegisteredModel): LanguageModelV4Middleware {
  const priced = (usage: {
    inputTokens?: { total?: number };
    outputTokens?: { total?: number };
  }) =>
    costOf(entry.cost, {
      inputTokens: usage.inputTokens?.total ?? 0,
      outputTokens: usage.outputTokens?.total ?? 0,
    });

  return {
    specificationVersion: "v4",

    async wrapGenerate({ doGenerate }) {
      const collector = currentCollector();
      if (!collector) return doGenerate();
      const startedAt = Date.now();
      try {
        const result = await doGenerate();
        collector.span({
          name: `model:${entry.id}`,
          kind: "model",
          startedAt,
          attributes: {
            model: entry.id,
            role: entry.role,
            inputTokens: result.usage.inputTokens.total ?? 0,
            outputTokens: result.usage.outputTokens.total ?? 0,
            costUsd: priced(result.usage),
          },
        });
        return result;
      } catch (error) {
        collector.span({
          name: `model:${entry.id}`,
          kind: "model",
          startedAt,
          status: "error",
          attributes: {
            model: entry.id,
            role: entry.role,
            error: error instanceof Error ? error.message : String(error),
          },
        });
        throw error;
      }
    },

    async wrapStream({ doStream }) {
      const collector = currentCollector();
      if (!collector) return doStream();
      // Only the time to first byte is recorded for a stream. The rest of the
      // duration is the user reading, not the model working, and a span that
      // called that latency would make every long answer look like a slow one.
      const startedAt = Date.now();
      const result = await doStream();
      collector.span({
        name: `model:${entry.id}`,
        kind: "model",
        startedAt,
        attributes: { model: entry.id, role: entry.role, streamed: true },
      });
      return result;
    },
  };
}

/**
 * The model for a role, with its fallbacks already behind it.
 *
 * Handed to callers that want a model instance rather than a call, which is
 * how eve takes it.
 */
export function model(
  role: ModelRole,
  policy: RoutingPolicy = "preferred",
): LanguageModel {
  const chain = candidates(role, policy);
  const [first, ...rest] = chain;
  const primary = openrouter().chatModel(first.id);
  const middleware: LanguageModelV4Middleware[] =
    rest.length === 0
      ? [tracingMiddleware(first)]
      : [
          tracingMiddleware(first),
          fallbackMiddleware(
            rest.map((entry) => openrouter().chatModel(entry.id)),
          ),
        ];
  return wrapLanguageModel({ model: primary, middleware });
}

/** The registry entry a role currently resolves to. */
export function selected(
  role: ModelRole,
  policy: RoutingPolicy = "preferred",
): RegisteredModel {
  return candidates(role, policy)[0];
}

type RoleOptions = { role?: ModelRole; policy?: RoutingPolicy };

/** One-shot text generation. */
export function generate(
  options: Omit<Parameters<typeof generateText>[0], "model"> & RoleOptions,
) {
  const { role = "conversational", policy, ...rest } = options;
  return generateText({ ...rest, model: model(role, policy) } as Parameters<
    typeof generateText
  >[0]);
}

/** Streaming text generation. */
export function stream(
  options: Omit<Parameters<typeof streamText>[0], "model"> & RoleOptions,
) {
  const { role = "conversational", policy, ...rest } = options;
  return streamText({ ...rest, model: model(role, policy) } as Parameters<
    typeof streamText
  >[0]);
}

/** Structured output against a schema. */
export function structured(
  options: Omit<Parameters<typeof generateObject>[0], "model"> & RoleOptions,
) {
  const { role = "drafting", policy, ...rest } = options;
  return generateObject({ ...rest, model: model(role, policy) } as Parameters<
    typeof generateObject
  >[0]);
}

/**
 * One embedding.
 *
 * Exposed because the blueprint says retrieval will consume it. Nothing calls
 * it yet and the registered embedding id has not been probed against the
 * provider, so the first caller has to verify it before trusting it.
 */
export function embed(options: Omit<Parameters<typeof sdkEmbed>[0], "model">) {
  return sdkEmbed({
    ...options,
    model: openrouter().textEmbeddingModel(selected("embedding").id),
  });
}

/** Many embeddings in one call. Same caveat as `embed`. */
export function embedMany(
  options: Omit<Parameters<typeof sdkEmbedMany>[0], "model">,
) {
  return sdkEmbedMany({
    ...options,
    model: openrouter().textEmbeddingModel(selected("embedding").id),
  });
}
