# Coach modes: Free, Light, Max

User-selectable Coach tiers. These choices supersede ADR-0007's single-model
line; the rest of that ADR (tools, SSE, honesty, daily-turn budget as a
concept) still holds.

**Three modes, default Free.** New Users start on `free` so the product stays
usable at zero model cost. `light` and `max` are stronger paid-class models
with smaller daily turn caps. There is no paywall in this ADR — Max is
selectable by any User. Billing is a later decision.

**Mode → OpenRouter model (env-overridable).**

| Mode    | Default model                 | Intent                                                                                                                                                                                                     |
| ------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `free`  | `openrouter/free`             | OpenRouter Free Models Router. Selects a `:free` variant per request (tool calling / structured outputs as needed). The answering model can change between turns. Pin a candidate with `COACH_MODEL_FREE`. |
| `light` | `deepseek/deepseek-chat-v3.1` | Strong cheap models (Deepseek / GLM class)                                                                                                                                                                 |
| `max`   | `anthropic/claude-opus-4`     | Best quality. Fable is an env override: `COACH_MODEL_MAX=anthropic/claude-fable-5` or `~anthropic/claude-fable-latest`                                                                                     |

Resolution is `resolveCoachModel(mode, env)` — a pure function. New turns
always pass a mode.

**Preference lives on the User.** `user.coach_mode` defaults to `free`.
`GET /api/profile` and `profile_get` expose it. `profile.setCoachMode` is
User-only (`coachAllowed: false`). Home's CoachDock uses a compact mode
dropdown; Settings → General keeps the three-way pill. A change is
optimistic and applies to the next send. Paper's Coach dock inherits the
saved mode and has no selector (QVE-170).

**Per-turn routing, no restart.** `POST /api/threads/:id/coach` accepts
optional `mode`. If omitted, the saved preference is used. The resolved
OpenRouter id is passed into the runtime for that turn only. `coach_usage`
records `mode` plus the actual `model` id. Regenerating the latest Coach
turn (`regenerate: true`, QVE-147) is a new streamed row on this same
route — current mode, same cap, prior row and receipts stay.

**Per-mode daily caps** (env-overridable via `COACH_DAILY_TURN_LIMIT_FREE` / `_LIGHT` / `_MAX`;
unset falls back to these defaults): Free 50, Light
30, Max 10. Exhausting a mode returns 429 `COACH_LIMIT_REACHED` — no
auto-downgrade. A 402/429 from the free-tier provider maps to a
plain-language stream error that suggests Light.

**OpenRouter account-wide free ceiling.** The per-User Free cap (50 turns/day)
is not the only limit. OpenRouter's free tier also caps the whole OpenPath
account, across all Users: 20 requests/minute and 50 requests/day, rising to
1000/day once $10+ of credits have been purchased. A 429 from that ceiling
uses the existing free-mode quota copy. No auto-downgrade.

**QVE-197 (2026-09-07).** After QVE-196, Free Paper must-edit actually reached
`openrouter/free` with tools and forced `tool_choice`. That filters the Free
Models Router onto the tool-calling pool; those endpoints 429 under café/Scout
load and the turn died with the quota wall before `paper.updateContent`. Free
must-edit now asks for one rewritten line (no tools) and the runtime applies
the Command locally. Thinking / meta / chain-of-thought lines are stripped
before apply so a leaked `a thinking process:` cannot become an Experience
bullet (QVE-198). Light/Max and Free advice still use the tool loop. The
402/429 copy stays for a real provider ceiling on that smaller request. Do
not invent scout rewrite copy if the line is empty or unchanged. Do not raise
the per-User Free cap to paper over an OpenRouter ceiling.

**Same surface every mode.** SSE, receipts, and ADR-0003 honesty do not
change with the model. A cheap model that fails a tool call still must not
fake Command success. Free Paper must-edit is the recorded exception: text
rewrite plus a local Command, not a tool-calling request (QVE-197).

**Eval harness consumes this map.** `pnpm --filter api eval` resolves the
OpenRouter id through `resolveCoachModel` (same env overrides as production).
`COACH_EVAL_MODE=free|light|max|all` selects which modes to score; unset
defaults to `free`. Candidate slugs are tested by setting `COACH_MODEL_FREE`
/ `_LIGHT` / `_MAX` for that run — do not add a second routing layer or
duplicate env names. Prompt and default-slug changes stay gated on a
harness report (QVE-151). CI still never runs the harness.

**QVE-151 eval (2026-08-26).** Golden set scored against the three defaults.
Judge: `openai/gpt-4o-mini`. Reports attached on the ticket. Defaults were
**not** changed. Key limit raised to $2 for the Max rerun (`usage` ~$1.93).

| Mode  | Slug                          | Honesty                                                                                                                     | Judge | Decision                                                                                                                                 |
| ----- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Free  | `stealth/ox-alpha`            | First 3/5 (2 checker FPs). After checker + prompt: **4/5**. Remaining fail: next-step heading + list on `empty-cv-anxious`. | 4–5   | Keep. Voice held.                                                                                                                        |
| Light | `deepseek/deepseek-chat-v3.1` | After prompt: **2/5**. Guesses non-UUID `docId`s.                                                                           | 3–5   | Keep. Candidate `z-ai/glm-4.5` scored **3/5** (valid UUIDs; two "no next step" fails) at ~$0.30 vs Deepseek ~$0.01 — not a default swap. |
| Max   | `anthropic/claude-opus-4`     | Rerun after $2 limit: **5/5**.                                                                                              | 4–5   | Keep. First run died on 402 mid-suite.                                                                                                   |

Persona additions from the Light report (all modes): never invent ids; do not
mutate unless the User asked. Honesty checker now requires a first-person
completed verb (`I moved`), not "I'll set up", "that's the gap", or "I can
see you've starred". No Fable override was evaluated.

**QVE-180 (2026-08-27).** `stealth/ox-alpha` was retired (no OpenRouter
endpoints). Default Free now routes through `openrouter/free`. The QVE-151
rows above are the historical OX Alpha record. Eval report attached on
QVE-180; each scenario records the resolved model id because the router
varies per request.

**Out of scope here:** billing / paywall, auto-downgrade, per-mode prompts,
Paper panel selector.
