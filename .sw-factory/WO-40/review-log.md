# Review Log: WO-40

**Work Order:** WO-40 - Build Model Gateway and router on the Vercel AI SDK
**Date:** 2026-08-13

## Review method

Run inline rather than by a review subagent: this agent operates under a
standing instruction not to spawn subagents unless the user asks. The
dimensions below are the ones `execution/review-phase.md` names.

## Scope

The change is inside the In Scope list and adds nothing from Out of Scope:

- Built: `ModelGateway`, `ModelRouter`, `ModelRegistry`, and the Coach turn
  routed through them.
- Exposed only: the embedding interface. No call site uses it, matching "WO-41
  consumes the gateway's embedding interface; this only exposes it".
- Not built: guardrails (WO-43), experiment-driven routing. The policy hook is
  the `RoutingPolicy` parameter, which is the "expose the policy hook, do not
  build the experiment layer" instruction.

## Blueprint alignment

| Blueprint contract | Where it lands |
|---|---|
| One interface, no direct provider calls | `lib/ai/gateway.ts` is the only file that calls `createOpenAICompatible`. Verified by grep across the repo. |
| Routing by role, with fallback and dedupe | `candidates()` returns the ordered chain; `fallbackMiddleware` walks it. |
| Cost bounded | `SessionLedger` allows, downgrades, then refuses. |
| Key isolation | `OPENROUTER_API_KEY` is read in `gateway.ts` only, which no client component imports. |
| Registry fields | `RegisteredModel` carries id, role, cost, latency, contextWindowTokens, providerOptions, as the `ModelRegistry` model block lists. |

### Documented deviation

The blueprint's `ModelRegistry` block gives a model one `role`. A model can
serve two roles well (fast enough for a greeting, capable enough for a draft),
so the registry holds one entry per model-and-role pair. The field stays
singular as the blueprint specifies; the same id simply appears twice. No
blueprint edit proposed, because the contract is unchanged.

## Correctness

Checked against the risk list in the plan:

- **eve accepts the wrapped model.** `PublicAgentStaticModelDefinition` is
  `string | LanguageModel`, and `wrapLanguageModel` returns a `LanguageModelV4`.
  Typechecks, and `eve dev` boots to `[eve:dev] server listening`.
- **The sampling did not get lost.** `transformRequestBody` now matches the
  model id in the request body against the registry, so sampling is a property
  of the model rather than of the provider. `registry.test.ts` asserts
  temperature 0.3 is still set for every conversational model.
- **Fallback cannot double-apply.** Two rules, both tested: a non-retryable
  error never falls back, and a stream that has already started never falls
  back. `doStream` resolving is the line.

## Verification

- `npx tsc --noEmit` clean.
- `npm run lint` clean.
- `npm test`: 316 pass, 0 fail (290 before, 26 added).
- `eve dev` boots clean. This is the check that caught a dead agent in a
  previous work order and is now run on every change that touches `agent/`.
- Live call probe: a real `generate()` through the gateway reached
  `https://openrouter.ai/api/v1/chat/completions` carrying the routed model id
  `deepseek/deepseek-v4-flash-0731`, went through `wrapGenerate` in
  `lib/ai/gateway.ts`, and was refused with 401 because
  `OPENROUTER_API_KEY` exists only on Vercel and not in this working copy. It
  correctly did **not** fall back, since 401 is not retryable.

### Limit

**A completed live turn was not observed locally.** The provider key is not in
the local environment, so no local call can succeed. The path is proven up to
authentication, and a real turn is verified against production after deploy
rather than asserted here.

## Verdict

**APPROVED**
