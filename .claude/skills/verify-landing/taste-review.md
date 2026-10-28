## Taste review (judged layer)

Eight judged items, each scored 0, 1 or 2, with an anchor text for 0 and for 2 (1 sits between). The anchors live in the reviewer prompt below, which is the single source:

- J1 the H1 alone says what is sold and for whom (research check 9)
- J2 each section earns the next
- J3 the objection "will this write a generic CV?" is answered before the first surface
- J4 the promise is proven
- J5 the sample is the right story
- J6 copy is specific
- J7 visual quiet
- J8 motion restraint

### Protocol

1. Run the checker with `VERIFY_LANDING_SHOTS=~/tmp/verify-landing/shots-<run>`. The four PNGs are the page every reviewer sees. Do not share the checker output with reviewers.
2. Spawn three reviewers from different model families, for example Claude, GPT through Codex, and Gemini or Grok through the T3 delegate. Each reads the four images and the source copy (`apps/web/src/features/landing/landing-copy.ts`), alone, with the prompt below. They do not see each other's scores.
3. A check passes at a median of 2 across the three. Any 0 from any reviewer is a finding, even when the median passes. The report lists each finding with the reviewer's quoted reason.
4. A reviewer who returns no reason for a score of 0 or 1 is rerun once with the same prompt; the second answer counts.

### Reviewer prompt

Copy this exactly, replacing the four image paths.

```text
You are reviewing the landing page of OpenCV, a career coach for Vietnamese students and new graduates who want a first job. You see four screenshots: <desktop-first-view.png> (the first screen at 1440x900), <desktop-full.png> (the whole page), <mobile-first-view.png> (the first screen at 390x844), <mobile-full.png> (the whole page). The page copy is in <landing-copy.ts>. Judge only what you can see and read; do not open the code or run anything.

Score each item 0, 1 or 2, using the anchors. 1 sits between them.
J1 The H1 alone says what is sold and for whom. 0: the reader needs the subhead or picture to know. 2: one sentence tells a stranger the product and who it helps.
J2 Each section earns the next. 0: a section repeats the last, or the order could be shuffled. 2: each section answers the question the last one raised.
J3 The objection "will this write a generic CV?" is answered before the first product section. 0: the doubt is still open at the first product section. 2: a sentence above it answers in the reader's terms.
J4 The promise is proven. 0: the claim is stated and nothing shows how. 2: the page shows what the coach does, with concrete evidence and no invented number.
J5 The sample is the right story. 0: a stranger, a placeholder title, or a performance figure. 2: a student's first role or school project, a real CV or letter, no percent.
J6 Copy is specific. 0: a sentence would fit any product, or leans on mood. 2: each sentence names a thing the product does, in the reader's words.
J7 Visual quiet. 0: competing accents, decoration or crowding fight the one action. 2: grey and one action, whitespace and type carry the hierarchy.
J8 Motion restraint. You cannot see motion in a still. Score it from the copy and layout: 0 if text or the product shot probably arrives late or decorated, 2 if it reads as present at first paint. If you cannot tell, score 1 and say so.

Answer with JSON only, no other text:
{"scores":{"J1":{"score":0,"reason":"<one sentence naming what you saw>"},"J2":{...},"J3":{...},"J4":{...},"J5":{...},"J6":{...},"J7":{...},"J8":{...}}}
Every reason is one sentence and quotes or names the thing on the page. Do not praise. Do not suggest fixes.
```

J8 is partly decided by checks 20, 21 and 25; the reviewers see stills, so treat J8 as a read on the layout and copy, and trust 20, 21 and 25 for the motion facts.
