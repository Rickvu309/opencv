# When the turn goes wrong: silence, hangs and failure have to render

- **Type:** `wayfinder:grilling`
- **Status:** closed
- **Assignee:** minhquanvu3902@gmail.com (via Claude)
- **Blocked by:** —
- **Map:** [Map, OpenPath backend on Eve](../map.md)

## Question

The happy path works. Production is defined by the other paths, and three are known
broken, observed rather than speculated:

### 1. A HITL question renders as silence

Observed: with thin context the agent parks the turn on eve's `ask_question`, in good
Vietnamese with sensible options. That is `instructions.md` rule 1 working, "hỏi, đừng
đoán". But `flatten()` in `thread.tsx` keeps only `text` parts, so the user sees typing
stop and nothing arrive, on a turn where the Coach did exactly the right thing.

Two resolutions, pick one and record why:

- **Render it.** The request rides on the last message as a `dynamic-tool` part at
  `part.toolMetadata?.eve?.inputRequest`, with `prompt` and `options`. Render prompt as
  coach prose and options as buttons; answer through the same session with
  `send({ inputResponses: [{ requestId, optionId }] })`. The turn is parked durably, so
  the answer resumes it. This is the full-fidelity answer and roughly a screen of UI.
- **Disable the tool** and let instructions tell the model to ask in plain prose, which
  the thread already renders. Cheaper, and it costs the structured options.

Either is defensible. Silence is the only wrong answer.

### 2. A hung turn hangs forever

Observed at 420s on the dead model: no `turn.failed`, no `onError`, a typing indicator
with no exit. The healthy model's local baseline is 20s with a measured max of 22s, so a
client-side watchdog has a number to work with: no stream progress for ~60s → fall back to
canned replies with the existing offline toast, and stop the indicator. eve's turn keeps
running server-side; if it lands later, the reducer will still apply it, and the dedup by
`toolCallId` already makes that safe for edits.

### 3. One empty completion was observed

One benchmark run returned 498ms, zero tokens, no error. Through the UI that is a turn
that ends with no reply and no explanation. Decide the rendering: treat
`turn.completed`-with-no-text as a failure ("Coach không trả lời được, thử lại nhé"), not
as success.

### And then prove it, against the deployed domain

This ticket closes with a smoke pass, run where the latency is real (after *Ship it*):

- streamed text visibly accumulates during a turn rather than appearing at once
- kill the agent mid-turn: the offline fallback fires, and the app never crashes
- the three paths above render what they should
- watch replies across a handful of turns for the two recorded model flaws, foreign-script
  tokens and "mình"→"tôi" drift; if either recurs at production temperature, the recorded
  answer is a stronger provider, not prompt surgery

## Resolution, 2026-08-04

Closed. Two of the three paths are verified end to end; the third is unit-tested and
honestly short of a live sighting, which is recorded below rather than glossed.

### 1, resolved: render the question

Chosen over disabling the tool. The model already produces good Vietnamese prompts with
sensible options; throwing that away to save a screen of UI is the wrong trade, and the
parked turn is durable so the buttons resume a live conversation rather than starting a
new one. An answered question stops offering its buttons, so a resumed turn cannot be
answered twice.

The projection moved out of the component to `lib/coach/messages.ts`, because it is pure
logic that was only in a `.tsx` file by accident and could not be tested there. Seven
tests now hold the rule this ticket exists for: **a turn that produced something must
never flatten to nothing.**

### 2, resolved: a 60s watchdog, and two real bugs found by testing it

Both bugs were mine, and both were found by measuring rather than assuming:

1. **The watchdog never fired.** It depended on the `agent` object, which `useEveAgent`
   rebuilds every render, so the effect re-ran continuously and reset its own clock.
   Measured: 189s into a deliberately hung stream, indicator still spinning. Fixed by
   depending on a boolean and reading `stop` through a ref.
2. **`checkAccess` had no deadline, and it sits in the recovery path.** The watchdog fired
   correctly, then called the probe, which never resolved because the network was black
   holed. The recovery from a hang could hang. Measured: `idle` frozen at exactly 60s with
   no fallback. Fixed with an 8s deadline; unanswered now means "unreachable".

Verified after both fixes: indicator stops at **63s**, offline fallback lands at **69s**
(60s watchdog plus the 8s probe deadline).

A note for whoever tests this next: a `fetch` mock that ignores `AbortSignal` is not a
hung fetch. Mine did, which hid the second bug for a full round and produced a confident
wrong conclusion. A faithful hang stays pending until aborted, then rejects.

### 3, resolved: an empty turn says so

`onFinish` checks whether the settled turn produced anything renderable and appends
"Mình chưa trả lời được câu này. Bạn thử hỏi lại giúp mình nhé." when it did not. A parked
question counts as having said something; genuine silence does not.

### Smoke pass, on the deployed domain

| Check | Result |
| --- | --- |
| Text visibly accumulates | **Yes.** 49 distinct lengths across 72 samples at 400ms, growing 2238 → 3369 chars between 7.2s and 11.6s |
| Stream dies mid-turn | Recovered in ~38s to the offline fallback, indicator stopped, **no crash** |
| Hung turn | Indicator stops at 63s, fallback at 69s (verified locally with a faithful hang) |
| Empty turn | Renders the Vietnamese failure line |
| Model flaws, 5 production turns | **1/5 foreign-script leak** (a single `达`), **0/5** register drift, latency 4.0–12.7s |

### Not observed live, and I am not claiming otherwise

`ask_question` fired twice earlier today and **not once in three deliberate attempts**
after the renderer landed, including one with no client context, which is what triggered
it before. So the parked-question UI has never been seen on screen. What is proven: the
projection keeps the question (seven tests), and the request shape the renderer reads was
captured from two real production `input.requested` events. What is unproven: that
clicking an option resumes the turn. It follows the documented contract, and it is the one
thing here I would want a human to click before trusting.

### The recorded model flaw persists

One foreign-script token in five production turns, at temperature 0.3. Lower than the 4/6
at the playground default, not zero. The recorded answer stands: **a stronger provider,
not prompt surgery.**

## Exit criterion

On the deployed domain: a turn that asks a question shows the question, a hung turn
degrades to canned replies within ~60s with the indicator stopped, an empty turn says so
in Vietnamese, and a mid-turn agent kill leaves the app usable. Nothing in the thread can
end in silence.
