# Copy

The voice law: every word a user reads passes this file. [design.md](design.md) keeps the one-paragraph summary; [AGENTS.md](../AGENTS.md) points here; feature specs carry the exact per-screen copy, which must pass these rules. Empty-state structure (five kinds, anatomy, one door) is [layout.md](design-system/layout.md); this file governs the words inside it.

## Voice

A good older mentor. Grounded, warm, honest. The tests, not the vibe:

- **Encouraging but never flattering.** Praise names the thing that earned it, or it is cut. "The project section is specific — that carries the CV" passes; "Great CV!" does not.
- **Every claim shows its basis.** A number, a fit, a readiness signal names its source in the same sentence. "You meet 4 of 6 requirements; missing SQL and one project" passes; "78% match" is banned.
- **Honest about distance.** If the goal is 18 months away, say 18 months, then the first step. Never shorten the road to be kind.
- **Pushes back with data.** Disagreement cites the profile or the posting, not opinion.
- **Apologizes without grovelling.** "Couldn't save. Try again." Never "We're so sorry for the inconvenience".

What the voice is not: HR-corporate ("leverage your competencies"), hype ("supercharge your career"), therapy-speak ("hold space for your journey"), startup cheer ("You've got this!"). If a line could open a webinar, cut it.

## Mechanics

- Sentence case everywhere, including headings and buttons.
- Second person. "You", never "the user". Possessives sparingly: "Profile", not "Your profile", unless ownership is the point.
- Contractions are fine. No exclamation marks, anywhere, ever.
- Simple English — most readers are non-native. One clause per sentence where possible; no idioms, no wordplay that will not translate.
- Numerals for numbers ("4 of 6", not "four of six"). Dates and times in the user's terms ("by Friday", "2 days left"), never ISO strings in prose.
- Full templated strings with pluralization, never fragments concatenated around a variable.
- One flow vocabulary: Continue to advance, Done to finish. Never alternate synonyms across steps.

## Lexicon

Typed exactly, in these casings: **CV**, **Resume**, **Cover letter**, **Proof**, **Apply**, **Uploaded**. Group labels: **Prepare**, **Opportunities**, **History**. The assistant is **the Coach**; the home place is **Coach**.

Banned words in UI: Applications (the place is Apply), journey, unlock, empower, supercharge, leverage, oops, awesome, amazing. Banned constructions: "Great question", "You've got this", any sentence that promises an outcome the profile cannot support.

Vietnamese names render whole: never truncated mid-diacritic, never clipped tone marks. Test with "Nguyễn Thị Ngọc Ánh".

## Per-surface patterns

**Buttons.** Verb first, naming the specific action. Never "Submit", "OK", or bare "Yes"/"No" on anything consequential. Confirmations repeat the consequence so the dialog is answerable without its body.

- Good: "Start a CV" · "Save to Apply" · "Delete this CV?" answered by "Delete CV" / "Cancel" · "Do it" / "Not now" on an approval card
- Bad: "Submit" · "Let's go!" · "Are you sure?" answered by "Yes" / "No" · "Approve" / "Reject" on a Coach write

**Errors.** What happened plus one next step, next to where it broke. No codes, no blame, no "oops". Hints phrased positively and shown before the mistake.

- Good: "Couldn't save. Check your connection and try again." · "Use at least 8 characters."
- Bad: "Error 500" · "Oops! Something went wrong." · "Invalid input."

**Empty states.** Obey the law in [layout.md](design-system/layout.md): one sentence of what this place is or why it is empty, optional basis line, one door. Filtered states name the query and the exit: "No results for 'data analyst in Da Nang'. Widen the search."

**Confirmations and undo.** State what just happened, with the noun, then the undo. "CV deleted. Undo." Never a celebration, never a checkmark with no words.

**Notifications.** Subject first, no urgency theatre. "VNG internship closes in 2 days." Never "Don't miss out!"

**Links.** Describe the destination: "See the published page", never "Click here" or a bare "Learn more".

**Settings.** Toggles label the on state ("Email me before deadlines"), never the negative. Field labels are visible; placeholders show the format, never do the label's job.

**Coach messages vs UI chrome.** The Coach's first person lives only in the thread and the dock; its persona is [mechanisms/coach-hands.md](mechanisms/coach-hands.md) and `persona.md`. Chrome reports about the Coach in third person and never impersonates it: "The Coach updated your profile. Undo." is chrome; "I've updated your profile" is only ever the Coach speaking, and only after a successful tool result. Approval card verbs: **Do it**, **Don't ask again in this conversation**, **Not now**. Thinking label: **Thinking**. Stop control: **Stop**. Queued bar: **Sends when the Coach finishes.** History groups: **Today**, **Yesterday**, **Earlier**.

## Basis rule

Any number, score, or readiness claim names its source in the same sentence or does not ship. This is the copy side of design.md's banned bare score. "You meet 4 of 6 requirements" carries its basis; "You're 80% ready" carries none and is banned — as is any invented statistic, testimonial, or claim of results nobody measured.

## Tone by stakes

One voice; the tone flexes:

| Context | Tone |
|---|---|
| First win, onboarding payback, empty states | Warm, can breathe |
| Routine actions, settings, lists | Neutral, minimal |
| Errors, destructive confirmations | Calm, plain, zero playfulness |
| Account deletion, data loss | Serious, explicit, consequence repeated |

## Out of scope

The Coach's conversational persona (coach-hands and `persona.md`), marketing copy beyond the landing page, Vietnamese localization (English UI for now — write so translation later is mechanical).
