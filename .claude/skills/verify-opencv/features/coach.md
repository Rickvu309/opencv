# Coach page and panel

Coach lives at `/app/coach` and `/app/coach/:chatId`. The shell panel shows the same thread. Sending a message streams a scripted reply. The runtime is the demo runtime, so no model or network is called.

## Sub-features

- `coach-start` shows How can I help? with six starters and More ideas.
- `coach-send` sends from the Message Coach textbox.
- `coach-reply` streams the scripted reply, including a step line and one bubble.
- `coach-history` opens from Chat history and groups the new chat under Today.
- `coach-panel` opens that chat from the dock on Apply. Expand goes to `/app/coach/:id`.

## How to get to it (user POV)

- Sign in (see `auth.md`).
- Open `/app/coach`, or choose Coach in the sidebar.

## Driving it with agent-browser

Preconditions: signed in; `run.env` loaded; `OPENROUTER_API_KEY=unset` in `run.env`.

- **Start.** `agent-browser open "$WEB_URL/app/coach"`. The heading is How can I help? The buttons are Review my CV, Find roles, Prep an interview, Write a cover letter, Plan my week, Negotiate an offer, and More ideas.
- **Starter.** `agent-browser find role button click --name "Review my CV"`. The Message Coach textbox contains Review my CV. Clear the field before the send below.
- **Send.** `agent-browser find role textbox fill "Help me prepare for a product intern interview" --name "Message Coach"`. `agent-browser find role button click --name "Send"`. Wait for `Prep the starred one next`.
- **Read the thread.** `agent-browser get text body` contains the sent message, then `I looked at Apply.`, `Listed your Apply cards`, and `Prep the starred one next.`
- **History.** `agent-browser find role button click --name "Chat history"`. The region Chats shows Today and a button for the new chat. Search chats filters that list. History is not a sidebar list.
- **Dock on Apply.** Open `$WEB_URL/app/apply`. Click the dock chip whose name is that chat. The panel shows `Prep the starred one next.` `agent-browser find role button click --name "Expand"`. The URL is `/app/coach/` plus the chat id.
- **390.** `agent-browser set viewport 390 844`. Open `$WEB_URL/app/coach`. The thread is one column. Open the dock Coach button. Expand is absent. The panel fills the screen.
- **Stop.** Fill Message Coach with text that contains `hold`, then Send. The stream stays open about three seconds and shows a step row before the bubble. Click Stop. One stopped bubble remains. The unit test `apps/web/src/routes/coach.test.tsx` covers the same stop.
- **Confirm.** Fill Message Coach with text that contains `confirm`, then Send. A step appears, then Approve and Deny. Approve posts `actions.approve` with the pending action id. The result card shows the document name with Open and Undo.
- **Fail.** Fill Message Coach with text that contains `fail`, then Send. The alert is `The Coach is unavailable right now. Try again in a moment.` The raw server text never appears.
- **Side effects.** `grep -ci openrouter "$EVIDENCE_DIR/api.log"` prints `0`.
- **Proof.** `agent-browser screenshot "$EVIDENCE_DIR/coach.png"` shows the thread with the scripted reply. Also save `coach-history.png`, `coach-panel.png`, and `coach-390.png`.

## Gotchas

- The default reply is fixed text from `apps/api/src/coach/fake.ts`. Prompts that do not contain `fail`, `hold`, or `confirm` get `I looked at Apply.` and `Prep the starred one next.` Assert on that text. `Help me prepare for a product intern interview` and `Move the card` stay on the default reply. First match wins, in the order fail, then hold, then confirm.
- The chat title comes from the first message. Read the dock chip name from the snapshot. Do not assume a fixed title.
- The Paper float still uses the old thread client. Do not drive the float as this recipe.
- Choosing Max on a free plan goes to `/app/settings/billing/upgrade` and leaves the mode on Free. Drive that only when the usage payload says the plan is free.
