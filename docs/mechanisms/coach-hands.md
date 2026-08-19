# The Coach's hands

Most AI career tools compute a recommendation and hand the user a report; the work is still theirs to do, alone, at midnight. OpenPath's bet is different: the Coach does the work with the user — builds the CV, logs the Proof, tailors the letter — and the user stays in control of every word. The mechanism that makes this safe rather than terrifying is structural: the Coach's hands are the user's hands.

## Why this exists

The target user cannot afford a mentor and freezes at blank pages. Advice does not unfreeze them; a first draft they can react to does. But an AI that edits your CV is only a feature if you trust it — and trust cannot be asked for, it has to be built into the machinery. Every design choice below exists to make trusting the Coach the rational default.

## Principles

1. **Parity.** There is one set of commands. A Coach change and a hand-made change are the same command, the same validation, the same log. The Coach can never do something the user could not, and never through a different door.
2. **Consent is the instruction.** "Build me a CV" means do it — asking "shall I?" after being told is friction dressed as politeness. The Coach asks first only when it would otherwise guess an important fact.
3. **Destruction is the exception.** Anything the user cannot recover requires their confirmation in the UI before the bus runs it. The Coach requests; the app asks; the user decides.
4. **Nothing happened until the tool succeeded.** The Coach never says "I've added" or "I've updated" without a successful result. One lie and the user checks everything forever — or worse, stops checking.
5. **Everything shows and everything reverses.** Every change surfaces as a confirmation with undo, and lands in a ledger the user can read.

## The mechanic

Four beats, always in this order:

**Ask.** The user says what they want, in their words, on any screen (the dock travels). The Coach may ask one clarifying question if a needed fact is missing — never a form's worth.

**Act.** The Coach calls a command. Commands with `agent: true` are its entire capability surface, generated from the same registry the UI uses ([ADR 0002](../adr/0002-command-bus.md)). The bus authorizes, validates, executes in a transaction, and logs with actor `coach` and the conversation id.

**Show.** Three surfaces make the change undeniable:
- A confirmation toast with undo, the same one a hand-made change gets.
- A **tool call** in the thread for every command the Coach called — running verb with shimmer, query chip, settled check, expandable Request / Result. Failed calls auto-open.
- An **artifact card** when the change produced a place the user can open (a CV, a Proof). Cards are windows, never editors; nobody types in a bubble.
- The ledger: `command_log` rendered as history ("the Coach updated your CV at 21:14"), so a user can audit a week of coaching in one glance.

**Approve.** Destruction is the exception (principle 3). A command with `destructive: true` does not run inside the agent turn. The tool returns a **proposal**; the stream emits `approval`; an approval card names the action and shows the payload. Three verbs, in our voice: **Do it**, **Don't ask again in this conversation**, **Not now**. The decision executes through the same bus, so Saved / Undo still apply. A 409 / already-applied case re-reads rather than implying the tap landed. "Don't ask again" grants that command name for the rest of this conversation only.

**Undo.** One tap executes the logged inverse through the same bus. Undo of a Coach change and undo of a user change are the same machinery, so it always works or honestly says it cannot (`inverse: null` — publishing, external effects).

### Edge states, all honest

| State | Behaviour |
|---|---|
| Tool failed | The Coach says it could not do it, never answers as if it had. The tool call auto-opens on the error. |
| Destructive pending | Approval card in the thread; the Coach waits; nothing is written |
| Destructive refused | The tool returns denied; the Coach acknowledges and does not retry |
| Destructive already applied | Card re-reads; copy does not claim this tap succeeded |
| Gateway down | The Coach shows offline; the app keeps working |
| Turn hangs | Stop waiting, offer retry |
| Budget exhausted | "You've used today's coaching" — plain, never silent |

## The AI inside it

The persona and turn loop are specified in [ai.md](../ai.md). The mechanism's constraints on the model: tools are the only side channel (no free-text instructions to the app), context is assembled from the same queries the UI reads (the Coach sees what the user could see, nothing more), and grounding rules forbid invented facts and numbers in anything it writes into the product.

## Connection points

Every feature that sets `agent: true` on a command is inside this mechanism — see the command tables in each [feature spec](../features/). The rule for new features: expose commands, not custom agent code. If the Coach needs a capability, the user gets the button too.

Navigation is a command too. Chat is a channel that can reach every core place ([flows.md](../flows.md) C2): a card the user taps, or `app.open` when they ask to go somewhere. Typed destinations only, logged, `inverse: null`, never unasked. The UI has the same links, so the agent cannot go somewhere the user cannot. Details: [features/navigation.md](../features/navigation.md).

## Growth roadmap

- **v1** — single commands per turn, confirmations, undo, artifact cards.
- **v-next: visible plans.** Multi-step requests ("get me ready for this posting") become a checklist the Coach executes step by step, each step a command with its own undo, stoppable mid-run. The plan is shown before it runs.
- **v-next: the ledger surface.** `command_log` as a first-class history view — filter by actor, undo from history.
- **v-later: scheduled hands.** With explicit standing consent, the Coach acts between sessions via the worker ("draft a follow-up two days before each deadline") — every scheduled act notifies, shows, and reverses like a live one. Consent is per-behaviour and revocable in Settings.
- **v-later: proactive suggestions.** The Coach may propose ("your CV still says second year") but never silently act. A suggestion is a card with a button, and the button is a command.

## What would kill it

- One claimed action that did not happen. This is the unforgivable failure; evals test it directly.
- A second write path — any code that mutates state off the bus breaks parity, undo, and the ledger at once.
- Capability drift — an agent-only ability, or a UI ability the agent lacks, turns the Coach back into a bolted-on bot.
- Nagging — proactive messages without consent turn a mentor into a notification engine.

## Success signals

- Share of Coach conversations that include at least one successful command — the "it does real work" measure.
- Undo rate on Coach changes: low but nonzero (zero means nobody checks; high means it guesses badly).
- Retention of users whose first session included a Coach-made artifact versus those without one.
- Zero eval failures on claimed-but-unperformed actions, ever.
