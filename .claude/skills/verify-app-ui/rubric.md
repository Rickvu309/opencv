# verify-app-ui rubric (judged layer)

Ten judged items for the app interior, each scored 0, 1 or 2. The anchors for 0 and 2 are in the reviewer prompt below, which is the single source; 1 sits between them. The rules come from the APPUI research (Apple HIG writing, layout and feedback; NN/g empty states and onboarding; Linear; Refactoring UI; shadcn AI Elements; WCAG 2.2). Each item says which mechanical checks inform it. The checks decide what a program can; these items decide what a program cannot.

- J1 The Coach composer is the first task on Home (checks 02, 14)
- J2 Each empty or starter state says what belongs there and links the next step (checks 06, 10, 11, 12)
- J3 The Coach shows what it did and asks before it changes work (checks 04, 08, 09, 30)
- J4 The starter data tells the right story (checks 06, 07, 12)
- J5 Copy is specific, plain and one noun per object (checks 01, 03, 05)
- J6 The work comes first and chrome recedes, one primary action per view (checks 15, 28, 36)
- J7 Visual quiet: grey, one action, color only means status (checks 19, 37)
- J8 Motion restraint (checks 24, 25, 26)
- J9 The four surfaces work at 390x844 (checks 21, 38)
- J10 Failures say what happened and what to do (checks 04, 27)

## Protocol

1. Run the checker with `VERIFY_APP_UI_SHOTS=~/tmp/verify-app-ui/shots-<run>`. It writes the screenshots listed in the prompt. Do not share the checker output with reviewers.
2. Spawn three reviewers from different model families, for example Claude, GPT through Codex, and Gemini or Grok through the T3 delegate. Each reads the images alone with the prompt below. They do not see each other's scores.
3. An item passes at a median of 2 across the three. Any 0 from any reviewer is a finding, even when the median passes. The report lists each finding with the reviewer's quoted reason.
4. A reviewer who returns no reason for a 0 or a 1 is rerun once with the same prompt; the second answer counts.
5. Reviewers see stills. J8 is scored from layout and copy; trust checks 24, 25 and 26 for the motion facts.

## Reviewer prompt

Copy this exactly, replacing the image folder.

```text
You are reviewing the signed-in app of OpenCV, a career coach for Vietnamese students and new graduates who want a first job. It has four surfaces: Home with the Coach, Paper (CV, Letter, Proof), Apply (a board of Opportunities in five stages) and Pitch (a public page). You see screenshots in <folder>: desktop-home.png, desktop-thread.png (a Coach turn), desktop-paper.png, desktop-paper-cv-coach.png (a CV open with the Coach beside it), desktop-apply.png, desktop-apply-empty.png (a board with no cards), desktop-pitch.png, desktop-coach-error.png (a failed Coach send), and mobile-home.png, mobile-paper.png, mobile-apply.png, mobile-pitch.png (390x844). Judge only what you can see and read; do not open the code or run anything.

Score each item 0, 1 or 2, using the anchors. 1 sits between them.
J1 The Coach composer is the first task on Home. 0: cards, chips and prompts compete with it, and a stranger would not know where to start. 2: the composer is the obvious first action and everything else is quiet or folded away.
J2 Each empty or starter state says what belongs there and links the next step. 0: a blank well, a placeholder shown as a name, or a banner that names a control that is not in view. 2: each empty state names what goes there and offers the way to add it in the same place.
J3 The Coach shows what it did and asks before it changes work. 0: a generic line such as "Worked for 1s", or a change that arrives with no step named and no way to refuse it. 2: each step names the object it touched, and a change waits for Approve or Deny.
J4 The starter data tells the right story. 0: a stranger, stock photos, an invented result such as a percent, or a sample that argues with its own "sample" banner. 2: a student's first role or school project, no invented number, and the sample and its banner agree.
J5 Copy is specific, plain and uses one noun per object. 0: two words for one object (job and opportunity, profile and Pitch, document and CV), or a label that would fit any product. 2: one noun per object and every label names what it does.
J6 The work comes first and chrome recedes, with one primary action per view. 0: summary cards, disabled controls or a floating panel sit above or over the work, and two buttons look equally important. 2: the work fills the view, supporting controls are quiet, one button is primary.
J7 Visual quiet. 0: decorative color, gradients or dark tiles compete with the one action. 2: grey, whitespace and type carry the hierarchy and color only means a status.
J8 Motion restraint. You cannot see motion in a still. Score it from layout and copy: 0 if something probably arrives late or decorated, 2 if nothing in the stills suggests late or decorated motion and everything reads as present at first paint. Say so when the still gives no evidence.
J9 The four surfaces work at 390x844. 0: content is cut off, controls are too small to tap, or a surface is unreachable. 2: all four surfaces are reachable and readable with room to tap.
J10 Failures say what happened and what to do. 0: the screen shows a raw system message such as "User not found." or a bare error with no next step. 2: it says in plain words what went wrong and offers a clear next step.

Answer with JSON only, no other text:
{"scores":{"J1":{"score":0,"reason":"<one sentence naming what you saw>"},"J2":{...},"J3":{...},"J4":{...},"J5":{...},"J6":{...},"J7":{...},"J8":{...},"J9":{...},"J10":{...}}}
Every reason is one sentence and quotes or names the thing on the screen. Do not praise. Do not suggest fixes.
```
