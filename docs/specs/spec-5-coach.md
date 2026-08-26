# Spec 5 — The Coach

**Status:** Done (QVE-136 / QVE-137–144) — production OpenRouter key is the remaining owner step (commands on QVE-144)
**Related:** ADR-0007 (coach runtime decisions), ADR-0003 (Coach Commands — the constitution this spec implements), ADR-0006 (the registry and data it runs on), ADR-0008 (English product language), PRODUCT.md (persona and principles)

## Problem Statement

The product's differentiator does not exist yet. Home says the Coach can't act — honestly, but a mentor who can only say "I can't help yet" is not a mentor. Meanwhile everything the Coach needs is built and idle: a Command registry with coach gating, server Threads, durable Paper docs and Apply cards, per-User auth. Users can get generic career advice anywhere; what no one else gives them is advice grounded in *their actual CV, their actual pipeline* — from something that can then do the work through the same Commands they'd click, and never lie about what happened.

## Solution

1. **The Coach speaks for real.** Streaming LLM replies (Vercel AI SDK over OpenRouter) in Home Threads, in the PRODUCT.md voice: grounded, warm, evidence over encouragement, exactly one next step, honest about distance.
2. **The Coach reads before it advises.** A compact workspace summary every turn plus read tools for detail — advice cites what it actually saw.
3. **The Coach acts through Commands — full surface.** Every coach-allowed, non-destructive Command becomes a tool (mechanically derived from the registry; `threads.postMessage` excluded — the stream is its voice, not a Command). Actions execute as the User, scoped by the same ownership checks, and every result — success or failure — renders as a receipt in the Thread. Deletes stay impossible for the Coach by construction.
4. **Honesty is mechanical, not aspirational.** Tool results are real envelopes; aborted turns persist the receipts of whatever actually ran; the transcript on reload is the true history.
5. **The User stays in control.** A Stop button ends a turn; failed sends surface an error with Retry; reversal notes on receipts say how to undo; a daily turn cap bounds cost.
6. **We can tell if it's good.** Thumbs on coach messages feed a usage table; a manual eval harness (golden scenarios, honesty checks, LLM judge) gates persona changes without burning CI tokens.

**Not in this spec:** the Paper AI panel (stays a stub with honest copy pointing Home; unification is a follow-up), Regenerate, destructive-command confirmation flow, one-click undo, Vietnamese-first Coach / i18n (settled English-first in ADR-0008 / QVE-150), multi-model routing, the in-app feedback channel (next spec — thumbs data lands where it will read).

## User Stories

1. As a **User**, I want the Coach to answer me for real, so that talking to it is worth my anxious ten minutes.
2. As a **User**, I want to see the reply appear as it's written, so that the Coach feels present, not loading.
3. As a **User**, I want advice that cites my actual documents and pipeline, so that I can trust it over generic tips.
4. As a **User**, I want the Coach to do things I ask — move a card, update my CV, start a doc — and show me a receipt of what it did, so that help means work done, not work described.
5. As a **User**, I want failed actions stated plainly ("Couldn't rename — doc not found"), so that I never believe something happened that didn't.
6. As a **User**, I want to stop a reply mid-stream and see what had already been done, so that interrupting is safe.
7. As a **User**, I want a clear message and a Retry when the Coach is unreachable, so that a network blip doesn't eat my message.
8. As a **User**, I want to rate a reply thumbs up or down, so that the Coach can get better from my reactions.
9. As a **User**, I want my conversations capped sensibly per day, so that the product stays free without surprises.
10. As the **owner**, I want every Coach action to flow through the registry's coach gate, so that the Coach can never do what a User couldn't.
11. As the **owner**, I want per-turn model, token, cost, and latency records, so that I see the cost curve before it sees me.
12. As an **agent maintaining the persona**, I want golden-scenario evals runnable on demand, so that prompt changes are measured, not vibed.

## Decisions

Technical decisions live in **ADR-0007**. Product decisions locked here:

- **Full command surface from v1** — all coach-allowed, non-destructive Commands are tools with a standard generic receipt pattern; per-command UX (CV diff previews) is prototyped later.
- **Auto-execution without confirmation** is ADR-0003-compliant for this surface (every exposed tool is reversible; deletes are structurally excluded). The confirm flow is designed-for but not built.
- **Default model Claude Sonnet 4.5** via OpenRouter, env-overridable; quality of tool use and voice outranks per-turn cost while user count is ~1.
- **Daily turn cap 50** per user (env-overridable).
- **English product language** is ADR-0008 / QVE-150: chrome and persona stay English; no locale toggle; incidental Vietnamese replies if the User writes Vietnamese.

## Ticket breakdown (tracer bullets)

Eight tickets under one parent: COACH-1 tool surface, COACH-2 data/config groundwork (parallel), COACH-3 route + port + SSE protocol (1,2), COACH-4 OpenRouter runtime + prompt (3), COACH-5 web streaming core (3, parallel with 4), COACH-6 receipts/markdown/actions (5), COACH-7 eval harness (4), COACH-8 deploy + smoke (4,5). The parent carries the standard verification protocol. `OPENROUTER_API_KEY` on both Railway environments is the one potentially-human step (COACH-8 comments exact commands if the agent can't set it).

## Definition of done

- [ ] Sending a message on production streams a real Coach reply, token by token, in the persona voice — waits on `OPENROUTER_API_KEY` (commands on QVE-144)
- [ ] The Coach reads workspace state and cites it; a request like "move my starred card to Prep" produces the move plus a truthful receipt — waits on the same key
- [x] Every Coach action flows through `registry.execute` with a coach actor; the coach-actor test sweep covers the full surface
- [x] Stop works; aborted turns persist executed-tool receipts with `aborted` status
- [x] Failed sends show an inline error with Retry; the Home stub reply string is gone (Paper panel stays a stub that points Home — QVE-146)
- [x] Copy and thumbs work on coach messages; ratings land in `coach_usage`
- [x] Turn cap returns a plain-language 429 at the limit; usage rows record model/tokens/cost/latency per turn
- [x] Missing API key degrades to 503 on the coach route only; `/health` untouched on staging and production (probed 2026-08-26); CI green including migration gate
- [x] Eval harness runs on demand and reports; it is not wired into CI
- [x] ADR-0007 committed; deploy docs updated; follow-up tickets filed

## Eval harness

Persona quality is measured on demand, never in CI. Before merging persona or
prompt changes, run `pnpm --filter api eval` with `OPENROUTER_API_KEY` set. The
script refuses without the key. Each golden scenario gets a fresh test
database, the real OpenRouter runtime, deterministic honesty checks (no
exclamation marks, no claimed action without a matching successful receipt,
exactly one next step, valid tool calls), then a cheap LLM judge with
rationale. Output is a markdown report on stdout. `pnpm test` and GitHub
Actions keep using the fake runtime so CI burns zero tokens.

## Follow-ups filed (QVE-144)

Work this spec deliberately deferred, now ticketed:

- [QVE-146](https://linear.app/quanvm/issue/QVE-146) — Paper AI panel unification
- [QVE-147](https://linear.app/quanvm/issue/QVE-147) — Coach message Regenerate
- [QVE-148](https://linear.app/quanvm/issue/QVE-148) — Destructive Command confirm flow
- [QVE-149](https://linear.app/quanvm/issue/QVE-149) — One-click reversal from Coach receipts
- [QVE-150](https://linear.app/quanvm/issue/QVE-150) — Vietnamese Coach + product copy (`ready-for-human`)
- [QVE-151](https://linear.app/quanvm/issue/QVE-151) — Coach prompt iteration + cheap-model fallback
- [QVE-152](https://linear.app/quanvm/issue/QVE-152) — Per-command Coach UX prototypes
- [QVE-153](https://linear.app/quanvm/issue/QVE-153) — Auto Thread titles from the first turn
