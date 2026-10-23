# Home Coach turn

Home (`/app`) is the Coach thread. Sending a message streams a scripted assistant reply into the thread and adds the thread to the History sidebar. The runtime is the demo runtime, so no model or network is called.

## Sub-features

- `coach-send` sends a message from the `Message Coach` textbox.
- `coach-reply` streams the scripted reply into the thread.
- `coach-history` lists the new thread in the History sidebar.

## How to get to it (user POV)

- Sign in and land on `/app`.
- Type in the `Message Coach` textbox and choose `Send`, or choose a suggestion chip such as `Prep interview`.

## Driving it with agent-browser

Preconditions: signed in on `/app` (see `auth.md`); `run.env` loaded; `OPENROUTER_API_KEY=unset` in `run.env`.

- **Type.** `agent-browser find role textbox fill "Help me prepare for a product intern interview" --name "Message Coach"`. The `Send` button becomes enabled.
- **Send.** `agent-browser find role button click --name "Send"`. Wait about 4 s, or `agent-browser wait --text "Prep the starred one next"`.
- **Read the thread.** `agent-browser get text body` contains the sent message, then `I looked at Apply.`, `Listed your Apply cards` and `Prep the starred one next.`
- **History.** `agent-browser snapshot -i` lists a button `Prepare for a product intern interview` under the `History` navigation, above `Welcome to ...`.
- **Side effects.** `grep -ci openrouter "$EVIDENCE_DIR/api.log"` prints `0`.
- **Proof.** `agent-browser screenshot "$EVIDENCE_DIR/home-coach-turn.png"` shows the thread with the scripted reply and the new History entry.

## Gotchas

- The reply is fixed text from `apps/api/src/coach/fake.ts`, and it is the same for every prompt. Assert on that text, not on the prompt.
- The thread title is derived from the first message by the scripted title generator, so it reads `Prepare for a product intern interview`, not the raw message.
- Coach also shows an aim prompt and a `Four small things` checklist on a new account. They do not block the input.
- Voice input, Copy link and More are disabled placeholders (`Coming soon`).
