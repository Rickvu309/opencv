# Coach modes: Free, Light, Max

User-selectable Coach tiers. These choices supersede ADR-0007's single-model
line; the rest of that ADR (tools, SSE, honesty, daily-turn budget as a
concept) still holds.

**Three modes, default Free.** New Users start on `free` so the product stays
usable at zero model cost. `light` and `max` are stronger paid-class models
with smaller daily turn caps. There is no paywall in this ADR — Max is
selectable by any User. Billing is a later decision.

**Mode → OpenRouter model (env-overridable).**

| Mode | Default model | Intent |
| ---- | ------------- | ------ |
| `free` | `stealth/ox-alpha` | OpenRouter free tier; OX Alpha is a preview and may change |
| `light` | `deepseek/deepseek-chat-v3.1` | Strong cheap models (Deepseek / GLM class) |
| `max` | `anthropic/claude-opus-4` | Best quality. Fable is an env override: `COACH_MODEL_MAX=anthropic/claude-fable-5` or `~anthropic/claude-fable-latest` |

Resolution is `resolveCoachModel(mode, env)` — a pure function. New turns
always pass a mode. `COACH_MODEL` remains only as a deprecated fallback when
mode is unset on a legacy path.

**Preference lives on the User.** `user.coach_mode` defaults to `free`.
`GET /api/profile` and `profile_get` expose it. `profile.setCoachMode` is
User-only (`coachAllowed: false`). The Home composer and Settings → General
share the same three-way control; a change is optimistic and applies to the
next send. The Paper AI panel is out of scope (QVE-146).

**Per-turn routing, no restart.** `POST /api/threads/:id/coach` accepts
optional `mode`. If omitted, the saved preference is used. The resolved
OpenRouter id is passed into the runtime for that turn only. `coach_usage`
records `mode` plus the actual `model` id.

**Per-mode daily caps** (env-overridable; fall back to `COACH_DAILY_TURN_LIMIT`
when the mode-specific var is unset, then to these defaults): Free 50, Light
30, Max 10. Exhausting a mode returns 429 `COACH_LIMIT_REACHED` — no
auto-downgrade. A 402/429 from the free-tier provider maps to a
plain-language stream error that suggests Light.

**Same surface every mode.** Tools, SSE, receipts, and ADR-0003 honesty do
not change with the model. A cheap model that fails a tool call still must
not fake Command success.

**Eval harness consumes this map.** `pnpm --filter api eval` resolves the
OpenRouter id through `resolveCoachModel` (same env overrides as production).
`COACH_EVAL_MODE=free|light|max|all` selects which modes to score; unset
defaults to `free`. Candidate slugs are tested by setting `COACH_MODEL_FREE`
/ `_LIGHT` / `_MAX` for that run — do not add a second routing layer or
duplicate env names. Prompt and default-slug changes stay gated on a
harness report (QVE-151). CI still never runs the harness.

**Out of scope here:** billing / paywall, auto-downgrade, per-mode prompts,
Paper panel selector.
