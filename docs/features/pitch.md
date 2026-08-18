# Pitch

**Track:** Commodity — an interview-prep answer bank, the pattern interview-prep tools and career centers use.

**Job:** the words the user says and posts about themselves — an online bio, a self-introduction, and prepared interview answers — ready before they freeze in the moment.

**Layout:** Sectioned editor at `/pitch` — primary is the build door while unbuilt; per-section saves are quiet. The dock must not cover it ([layout.md](../design-system/layout.md)).

## Concept

Where Paper produces documents the user sends, Pitch produces language the user speaks and posts. Kept separate so interview and self-presentation help — the thing this audience freezes on most — has its own space. Three kinds: one bio (for LinkedIn and profiles), one self-introduction ("tell me about yourself"), and many answers, each carrying the question it answers.

## Screens

- Reached from the Prepare group in the rail, next to Paper ([flows.md](../flows.md)).
- `/pitch` — three labelled sections: bio, intro, answers. One primary per section; drafting is the quiet secondary. An unbuilt Pitch is one door (draft from the profile). A missing goal for intro is an in-place next step, not a browser alert.

## Data

`pitch_items` ([data.md](../data.md)). One `bio` and one `intro` per user; saving again replaces, with undo.

## Commands

| Command | Agent | What |
|---|---|---|
| `pitch.saveBio` | yes | Write or replace the bio |
| `pitch.saveIntro` | yes | Write or replace the self-introduction |
| `pitch.addAnswer` | yes | A new answer with its question |
| `pitch.updateItem` | yes | Refine any item in place |
| `pitch.removeItem` | yes | Destructive: confirm first |

## AI

`ai.server.ts`: draft a bio from the profile; draft an intro from the profile and goal; draft an answer grounded in real experience. Exposed to the Coach as tools.

## Coach behaviour

- Bio: drafts from the profile alone.
- Intro: needs the goal — if none is set, ask before drafting.
- Answers: must rest on work the user actually did. If the question needs an example the profile lacks, ask for one first. Never invent an experience; the user takes that sentence into a real interview.

## Empty state

"Say who you are once, properly." Primary action: draft the bio from your profile.

## Out of scope

Mock-interview mode, audio practice, question libraries by company. Later candidates, not v1.
