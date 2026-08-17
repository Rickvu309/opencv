// The fallback is the part of the gateway that only runs on a bad day, which
// is the part most likely to be wrong. These tests give it a bad day on
// purpose. Nothing here reaches the network.

import { test } from "node:test";
import assert from "node:assert/strict";
import { APICallError } from "ai";
import type {
  LanguageModelV4,
  LanguageModelV4CallOptions,
  LanguageModelV4GenerateResult,
} from "@ai-sdk/provider";

import { fallbackMiddleware, isWorthFallingBack, selected } from "@/lib/ai/gateway";

const CALL: LanguageModelV4CallOptions = {
  prompt: [{ role: "user", content: [{ type: "text", text: "chào" }] }],
};

/** A model that answers with its own name, or refuses in a stated way. */
function stub(
  modelId: string,
  behaviour: "answer" | (() => never),
): LanguageModelV4 & { calls: number } {
  const model = {
    calls: 0,
    specificationVersion: "v4" as const,
    provider: "test",
    modelId,
    supportedUrls: {},
    async doGenerate(): Promise<LanguageModelV4GenerateResult> {
      model.calls += 1;
      if (behaviour !== "answer") behaviour();
      return {
        content: [{ type: "text", text: modelId }],
        finishReason: { unified: "stop", raw: "stop" },
        usage: {
          inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
          outputTokens: { total: 1, text: 1, reasoning: 0 },
        },
        warnings: [],
      };
    },
    async doStream() {
      model.calls += 1;
      if (behaviour !== "answer") behaviour();
      return {
        stream: new ReadableStream({
          start(controller) {
            controller.close();
          },
        }),
      } as Awaited<ReturnType<LanguageModelV4["doStream"]>>;
    },
  };
  return model;
}

const overloaded = () => {
  throw new APICallError({
    message: "upstream is overloaded",
    url: "https://openrouter.ai/api/v1/chat/completions",
    requestBodyValues: {},
    statusCode: 503,
    isRetryable: true,
  });
};

const rejected = () => {
  throw new APICallError({
    message: "that tool schema is not valid",
    url: "https://openrouter.ai/api/v1/chat/completions",
    requestBodyValues: {},
    statusCode: 400,
    isRetryable: false,
  });
};

test("an overloaded provider is worth another model", () => {
  assert.equal(isWorthFallingBack(tryCatch(overloaded)), true);
});

test("a rejected request is not worth another model", () => {
  // The second model would refuse the same malformed request in the same way,
  // only slower and for money.
  assert.equal(isWorthFallingBack(tryCatch(rejected)), false);
});

test("a transport failure is worth another model", () => {
  assert.equal(isWorthFallingBack(new Error("fetch failed")), true);
});

test("an ordinary bug is not mistaken for an outage", () => {
  assert.equal(isWorthFallingBack(new TypeError("x is not a function")), false);
});

test("generate falls back to the next model when the first is overloaded", async () => {
  const second = stub("second", "answer");
  const middleware = fallbackMiddleware([second]);
  const first = stub("first", overloaded);

  const result = await middleware.wrapGenerate!({
    doGenerate: () => first.doGenerate(CALL),
    doStream: () => first.doStream(CALL),
    params: CALL,
    model: first,
  });

  assert.equal(second.calls, 1);
  assert.deepEqual(result.content, [{ type: "text", text: "second" }]);
});

test("generate does not fall back on a rejected request", async () => {
  const second = stub("second", "answer");
  const middleware = fallbackMiddleware([second]);
  const first = stub("first", rejected);

  await assert.rejects(
    Promise.resolve(
      middleware.wrapGenerate!({
        doGenerate: () => first.doGenerate(CALL),
        doStream: () => first.doStream(CALL),
        params: CALL,
        model: first,
      }),
    ),
  );
  // The dedupe guarantee in its simplest form: the request that could not be
  // served was served exactly zero further times.
  assert.equal(second.calls, 0);
});

test("a stream falls back only before it has started", async () => {
  // `doStream` resolving is the line. Before it, nothing has been delivered
  // and a retry is invisible to the user. After it, the turn belongs to the
  // model that started it, and a second stream would repeat text the user has
  // already read or re-apply a tool call already emitted.
  const second = stub("second", "answer");
  const first = stub("first", overloaded);
  const middleware = fallbackMiddleware([second]);

  await middleware.wrapStream!({
    doGenerate: () => first.doGenerate(CALL),
    doStream: () => first.doStream(CALL),
    params: CALL,
    model: first,
  });

  assert.equal(second.calls, 1);
});

test("every alternate is tried once, then the original error stands", async () => {
  const second = stub("second", overloaded);
  const third = stub("third", overloaded);
  const first = stub("first", overloaded);
  const middleware = fallbackMiddleware([second, third]);

  await assert.rejects(
    Promise.resolve(
      middleware.wrapGenerate!({
        doGenerate: () => first.doGenerate(CALL),
        doStream: () => first.doStream(CALL),
        params: CALL,
        model: first,
      }),
    ),
    /overloaded/,
  );
  assert.equal(second.calls, 1);
  assert.equal(third.calls, 1);
});

test("the Coach turn resolves to a model without touching the network", () => {
  // Cheap proof that the seam is wired: a role in, a registry entry out, no
  // provider key required to find out which one.
  assert.ok(selected("conversational").id.length > 0);
  assert.notEqual(selected("conversational").id, selected("drafting").id);
});

/** Runs a thrower and hands back what it threw. */
function tryCatch(thrower: () => never): unknown {
  try {
    thrower();
  } catch (error) {
    return error;
  }
}
