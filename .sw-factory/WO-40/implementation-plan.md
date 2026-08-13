# Implementation Plan: WO-40

**Work Order:** WO-40 - Build Model Gateway and router on the Vercel AI SDK
**Blueprints:** Model Gateway & Routing, Coach Agent

## Problem

Today `agent/agent.ts` builds an OpenRouter provider inline and hands one hardcoded
model to `defineAgent`. That is the only model call site in the repo, which sounds
tidy until a second one appears: the next feature that needs a structured draft or
an embedding will copy those thirty lines, and then the provider key, the sampling
defaults and the model choice live in two places that drift.

The blueprint asks for a seam: a registry of routable models, a router that picks
one per task role with a fallback, and a gateway that makes the call. The point is
that a model change is a configuration edit, not a code edit.

## Approach

Three files under `lib/ai/`, mirroring the three blueprint components.

### `lib/ai/registry.ts` - the `ModelRegistry`

A plain configuration array. Each entry carries what the blueprint's `ModelRegistry`
model lists: `id`, `role`, `cost` (input/output per million tokens), `latency`,
`contextWindowTokens`, `providerOptions`.

Roles: `conversational`, `drafting`, `fast`, `embedding`.

The two models already probed against the real tool schema (`deepseek-v4-flash-0731`
and `nemotron-3-ultra-550b-a55b:free`) become the first two entries rather than a
comment. `OPENPATH_MODEL` keeps working: it overrides the id used for the
conversational role, so the existing operational escape hatch is not taken away.

### `lib/ai/router.ts` - the `ModelRouter`

Pure functions over the registry, so the routing policy is testable without a
network:

- `candidates(role, policy)` returns the ordered list for a role: the preferred
  model first, then the fallbacks. Ordering is by policy (`cheapest` or `best`),
  and a role with no entry is a thrown configuration error, not a silent default.
- `withinContext(model, tokens)` rejects an oversized request at the gateway
  rather than paying a provider to reject it.
- `SessionLedger` holds per-session token counts and enforces the ceilings, with
  three outcomes: `allow`, `downgrade` (route to the cheaper model), `refuse`.
  Refusing is the honest end state for a runaway loop; the blueprint says
  "refusing or downgrading rather than billing a runaway loop".

### `lib/ai/gateway.ts` - the `ModelGateway`

Builds the OpenAI-compatible provider once (key from `OPENROUTER_API_KEY`,
server-side only, moved out of `agent/agent.ts` unchanged) and exposes:

- `model(role)` - an AI SDK `LanguageModel` for that role, already wrapped with
  the fallback middleware, for callers like eve that want a model instance.
- `generate`, `stream`, `structured` - thin wrappers over the SDK's
  `generateText` / `streamText` / `generateObject` that take a role instead of a
  model.
- `embed`, `embedMany` - the embedding interface WO-41 will consume. Exposed
  only; nothing calls it in this work order.

Fallback is a `LanguageModelV4Middleware`. `wrapGenerate` and `wrapStream` catch a
provider error and call the next candidate's `doGenerate` / `doStream` with the
same params. Dedupe: a retried turn must not double-apply, so the middleware
records the attempt against a request key and will not re-enter fallback for a
request that already produced a result.

### Wiring `agent/agent.ts`

`defineAgent({ model: gateway.model("conversational") })`. The context window and
the session limits come from the registry entry rather than from a literal, so
switching the model also switches the window. The long comment block explaining
the model probes moves to the registry, next to the entries it describes.

## Files

| File | Change |
|---|---|
| `lib/ai/registry.ts` | new: the model set and its selection metadata |
| `lib/ai/router.ts` | new: role selection, fallback order, session ceilings |
| `lib/ai/gateway.ts` | new: the AI SDK seam and the fallback middleware |
| `lib/ai/registry.test.ts` | new |
| `lib/ai/router.test.ts` | new |
| `lib/ai/gateway.test.ts` | new |
| `agent/agent.ts` | rewrite to call the gateway |

## Testing

The router and registry are pure, so they are tested directly:

- every role in the registry resolves to at least one model
- the conversational role has a fallback, so a provider outage has somewhere to go
- `OPENPATH_MODEL` overrides the conversational id and nothing else
- an oversized request is rejected against the registry's context window
- the ledger allows, then downgrades, then refuses as the session spends
- costs are present and ordered, so `cheapest` really is the cheaper one

The gateway's fallback middleware is tested with two stub `LanguageModelV4`s: the
first throws, the second answers, and the result must come from the second. A
second test proves the dedupe: one failing call falls back once, not twice.

No test makes a network call. The provider is only constructed when a model is
actually asked for, so importing the gateway in a test does not require a key.

## Risks

- **eve's model type.** eve takes the AI SDK model instance. If its declared type
  is narrower than `LanguageModel`, the wrapped model may not satisfy it. Checked
  first; if it does not typecheck, the fallback wrapper is still returned and the
  declaration is widened at the call site rather than dropping fallback.
- **Removing the inline provider.** The `transformRequestBody` hook carrying
  `temperature: 0.3` is load-bearing (it is what stopped stray CJK tokens leaking
  into Vietnamese replies). It moves into the registry's `providerOptions` intact,
  and a test asserts it is still applied.
