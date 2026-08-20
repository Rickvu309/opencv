# Coach

**Track:** the chat surface is Commodity, cloned from [Onyx Opal Craft](https://onyx-storybook.vercel.app/) (approval, input bar), [assistant-ui Thread](https://www.assistant-ui.com/docs/ui/thread), [reasoning panel](https://www.assistant-ui.com/elements/reasoning-panel), and [tool call](https://www.assistant-ui.com/elements/tool-call), and [Beautiful UI](https://www.beautifului.dev/) Chat / Prompt Bar. The Coach's hands — operating the product through the command bus — are Signature: deep design in [mechanisms/coach-hands.md](../mechanisms/coach-hands.md) ([ADR 0002](../adr/0002-command-bus.md), [ADR 0006](../adr/0006-port-opal.md)).

**Job:** answer career questions grounded in the user's real profile, and do the work in the app on request — then always name the one next concrete step.

**Layout:** Conversation on `/coach` — the composer is the primary slot, no dock. The dock itself is an Overlay travelling on every other signed-in screen ([layout.md](../design-system/layout.md)).

## Concept

The Coach is the home of the product and its operating layer. It is not a support widget: it drafts a CV, sharpens a bullet, tailors a letter, logs a Proof entry, or updates the profile using the same commands the user's clicks trigger, so a Coach change is indistinguishable from a hand-made one and every change has undo. Its honesty is the core promise: it never fabricates a fact or number, never claims an action without a successful tool result, and is honest about how far a goal is.

## Screens

- `/coach` — the conversation. Reached from the Coach place in the rail. Signing in lands on dump (`/proof/$proofId`) when they have no proofs, or `/proof` when they already have logs. Thread history lives in the rail under History, not a second list on this page. The open thread is `/coach?thread=<id>`. No dock here; the page is the conversation. The composer is a single bordered surface with the field and send control inside; messages are user blocks vs Coach body text, not role-prefixed paragraphs.
- The coach dock — the same conversation in small form, travelling on every artifact screen and on Account. Not on `/coach`, landing, auth, onboarding, or public pages. Leaving `/coach` opens the dock on the same thread; Open Coach returns to `/coach`. On an opened CV (`/paper/$paperId`) the turn includes that paper's content; Add to Coach attaches a highlighted line as excerpt context for the next turn. A successful `paper.*` tool refreshes the A4.
- Cloned patterns: streamed markdown replies, stop and retry, reasoning panel, tool calls, artifact cards, approval cards for destructive commands, thread history with rename (in the rail), composer with stop / interrupt hint / queued message, starter prompts drawn from the user's profile.
- Trust surfaces: "the Coach updated your CV" confirmations with undo (from `command_log`), an honest offline state when the gateway is unavailable, a stalled-turn state with retry, and a said-nothing state instead of an empty bubble.

## Data

`conversations`, `messages` ([data.md](../data.md)). Coach-caused writes land in `command_log` with actor `coach` and the conversation id.

## Commands

| Command | Agent | What |
|---|---|---|
| `conversation.start` | no | New thread |
| `conversation.rename` | no | Named from the first message by default; user can rename |
| `conversation.remove` | no | Destructive: confirm first |
| `app.open` | yes | Open a place or artifact the user asked to see. Typed destination, never a raw URL. `inverse: null`. Vocabulary and forbidden targets: [navigation.md](navigation.md) |

The Coach's real capabilities are other features' commands with `agent: true`; see each spec. The Coach never has a capability the UI lacks. Navigation is a command like everything else: logged, visible, and only on instruction ([flows.md](../flows.md) channel C2).

## Behaviour rules

- An instruction is consent: "build me a CV" means call the tool, not ask again. "Open my CV" is `app.open`, not a guess. Ask first only when a needed fact would otherwise be guessed. Never navigate unasked; creating an artifact yields a card, not a jump.
- Destructive commands: the app confirms in the thread (approval card) before the bus runs them; a refusal returns a denied tool result and the Coach says so. "Don't ask again in this conversation" grants that command name until the conversation ends.
- After a successful call: one short sentence. The app shows the confirmation and undo; do not recap details.
- Every substantive reply ends with exactly one concrete next step, or says plainly that there is none.
- Persona, context builder, tool generation, and the turn loop: [ai.md](../ai.md).

## Empty state

A calm empty thread like Grok plus Lab AI suggestion chips: mark, the composer, three starters, and a connect-email banner. Starters fill the composer; they do not send. If the profile has a target role, the first two chips name it. Never a blank pane. The activation checklist is not on this surface.

## Out of scope

Voice input, multi-agent anything, proactive unprompted messages (the Coach speaks when spoken to; nudges belong to notifications).
