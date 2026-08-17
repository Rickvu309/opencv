# AI

Three layers — gateway, Coach agent, task AI — and a trust layer over all of them. The Coach is the product's differentiator; the architecture keeps it powerful without letting every AI call become a conversation.

## Gateway (`src/core/ai/`)

All model calls go through one gateway built on the Vercel AI SDK over OpenRouter. Features never name a model; they ask for a role.

| Role | For | Character |
|---|---|---|
| `chat` | Coach turns | Strong tool-calling, good prose |
| `drafting` | CV bullets, letters, pitch answers, Proof stories | Best writing quality |
| `extraction` | Posting text to requirement lines | Structured output, cheap |
| `scoring` | Fit reads against the profile | Structured output, consistent |
| `cheap` | Titles, summaries, classification | Fastest and cheapest |

The role-to-model table lives in one file in `core/ai/` and is the only place a model name appears. Budget caps and per-account rate limits are enforced here, so no feature can bypass them. Without `OPENROUTER_API_KEY` the gateway reports unavailable; callers degrade honestly (the Coach shows an offline state, task AI buttons disable with a plain sentence) and the rest of the app runs.

## Coach agent (`src/features/coach/agent/`)

An isolated module ([ADR 0004](adr/0004-coach-in-process.md)) with four parts:

**Persona** (`persona.md`): a mentor a few years ahead. Second person, plain sentences, no exclamation marks, three paragraphs at most. Evidence before advice — every claim rests on the profile or real data, and missing data means asking, not guessing. Always one concrete next step. Honest about distance. Never claims an action without a successful tool call: until a tool returns success, nothing has changed, and saying otherwise is the one unforgivable lie.

**Context builder**: assembles what the model sees each turn — a profile snapshot, counts and recent items from each feature, the screen the user is on, and the conversation so far. The context is built from feature queries, so what the Coach sees is exactly what the user could see. Nothing UI-local (viewport, popovers) ever enters context.

**Tools**: generated from the command registry — every command with `agent: true` becomes a tool, its Zod schema and description included, so the Coach's hands and the user's hands are the same hands ([ADR 0002](adr/0002-command-bus.md)). Read tools wrap feature queries. Task AI functions (below) are also exposed as tools where a conversation benefits, like drafting a letter.

**Turn loop**: streams over SSE from `src/routes/api/`. Tool calls execute on the bus with actor `coach` and the conversation id, so `command_log` can say "the Coach did this" and offer undo. Messages persist to `conversations` / `messages`; the UI renders artifact cards for changed entities that link to the real screens.

Deletion is the one asymmetry: destructive commands executed by the Coach require user confirmation in the UI before the bus runs them. The tool returns a denied result if the user refuses, and the Coach says so.

## Task AI (`src/features/*/ai.server.ts`)

Non-conversational functions that call the gateway directly. Owned by the feature, described in its spec:

| Feature | Function |
|---|---|
| Search | Extract requirement lines from pasted posting text; score fit against the profile with per-requirement working |
| Paper | Sharpen a bullet into a result line; draft a cover letter from the profile and an opening |
| Pitch | Draft a bio, intro, or interview answer from the profile |
| Proof | **The interviewer** (signature): question prompts that pull specifics out of the user about work they actually did — what it was, what they did, what came of it — and the arranger that shapes a log into a publishable story without adding a single fact the user did not give |

## Trust layer

- **Grounding**: drafting functions receive only the user's real profile and entries. The rule, enforced in prompts and checked in evals: no invented facts, no invented numbers. "We shortened the intake process" is a sentence the user can defend; "cut time by 40%" when nobody measured it is not.
- **Refusal areas**: no legal, medical, or personal-finance advice. Off-topic requests get a brief answer and a return to their direction.
- **Budget**: per-account daily token budgets and rate limits at the gateway. Exceeding them degrades to an honest "you've used today's coaching" state, never a silent failure.
- **Traces**: every turn and task call writes an `ai_trace` (role, tokens, cost, duration, tools called). Traces are the debugging record for prompt work and the cost meter for budgets.
- **Guardrail events**: input and output checks log to `guardrail_events` when they trip.

## Evals

Golden conversations live beside the agent and run with `npm test` (skipping without a key): scripted user turns, scored against a rubric — grounded (no fact not in the profile), honest (no claimed action without a tool success), directive (exactly one next step), voice (no exclamation marks, no flattery). A prompt change that drops the rubric score fails the suite. Drift checks re-run the goldens on a schedule via the worker.
