# Coach

**Track:** the chat surface is Commodity, cloned from ChatGPT / Claude conversation patterns. The Coach's hands — operating the product through the command bus — are Signature: deep design in [mechanisms/coach-hands.md](../mechanisms/coach-hands.md) ([ADR 0002](../adr/0002-command-bus.md)).

**Job:** answer career questions grounded in the user's real profile, and do the work in the app on request — then always name the one next concrete step.

## Concept

The Coach is the home of the product and its operating layer. It is not a support widget: it drafts a CV, sharpens a bullet, tailors a letter, logs a Proof entry, or updates the profile using the same commands the user's clicks trigger, so a Coach change is indistinguishable from a hand-made one and every change has undo. Its honesty is the core promise: it never fabricates a fact or number, never claims an action without a successful tool result, and is honest about how far a goal is.

## Screens

- `/coach` — the conversation, and where signing in lands.
- The coach dock — the same conversation, docked on every other screen.
- Cloned patterns: streamed markdown replies, stop and retry, thread history with rename, composer with full keyboard support, starter prompts drawn from the user's profile, artifact cards in the thread (a changed CV, a logged Proof) that open the real screen.
- Trust surfaces: "the Coach updated your CV" confirmations with undo (from `command_log`), an honest offline state when the gateway is unavailable, a stalled-turn state with retry, and a said-nothing state instead of an empty bubble.

## Data

`conversations`, `messages` ([data.md](../data.md)). Coach-caused writes land in `command_log` with actor `coach` and the conversation id.

## Commands

| Command | Agent | What |
|---|---|---|
| `conversation.start` | no | New thread |
| `conversation.rename` | no | Named from the first message by default; user can rename |
| `conversation.remove` | no | Destructive: confirm first |

The Coach's real capabilities are other features' commands with `agent: true`; see each spec. The Coach never has a capability the UI lacks.

## Behaviour rules

- An instruction is consent: "build me a CV" means call the tool, not ask again. Ask first only when a needed fact would otherwise be guessed.
- Destructive commands: the app confirms with the user before the bus runs them; a refusal returns a denied tool result and the Coach says so.
- After a successful call: one short sentence. The app shows the confirmation and undo; do not recap details.
- Every substantive reply ends with exactly one concrete next step, or says plainly that there is none.
- Persona, context builder, tool generation, and the turn loop: [ai.md](../ai.md).

## Empty state

A calm thread with three starter prompts built from the profile ("Where do I start", "Look at my CV", "What fits my background"). Never a blank pane.

## Out of scope

Voice input, multi-agent anything, proactive unprompted messages (the Coach speaks when spoken to; nudges belong to notifications).
