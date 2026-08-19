# Proof

**Track:** Signature — OpenPath's own mechanism ([ADR 0005](../adr/0005-proof-own-domain.md)). There is no reference app; this is the thing we are tinkering into existence. This spec is operational; the design itself — why, the beats, the interviewer, the roadmap — lives in [mechanisms/proof.md](../mechanisms/proof.md), which outranks this spec on intent.

**Job:** help a user build up evidence of their work and skills over time, with AI support — so that when someone asks "what have you actually done", the answer exists, is specific, and is theirs.

**Layout:** Drive list at `/proof` (primary: Log something), Opened space at `/proof/$proofId` (primary: Arrange until the story is arranged, then Publish — one primary at a time). The dock must not cover the band ([layout.md](../design-system/layout.md)).

## Concept

Early-career users believe they have nothing to show. Proof teaches them otherwise: a class project, a shift at a café, an assignment, something that failed — all of it counts if the specifics are captured. A Proof is a space, not a document: a running log of what happened, fed as it happens, that the Coach helps shape into a story and publish as a designed page. It is never required and never shamed.

In the rail, Proof is not a row. It is opened from Paper, a Coach card, or a URL. `/proof` marks Paper. The domain stays its own ([ADR 0005](../adr/0005-proof-own-domain.md), [flows.md](../flows.md)).

The loop (flow 5 in [flows.md](../flows.md)): log → interview → arrange → publish → connect outward (personal page, a CV line, a shared link). This loop is the retention engine, and its published pages are the seed of the future sharing and social layer.

## Screens

- `/proof` — the evidence space: proofs as rows (title, role, dates, status), newest activity first.
- `/proof/$proofId` — the opened Proof: band with Back, title, and one primary at a time (Arrange until the story has all three parts, then Publish). The band names the missing part. Body: running log newest first; no STAR form, no wizard.
- Arranged view: the story in three parts — what the project was, what they did, what came of it. All three or it is not a story yet; the band says which part is missing.
- Published: a designed page at `/p/:slug` (see [share.md](share.md)) — the one expressive surface in the product: photos and type allowed, taste quiet. The four jobs of a published Proof: sound smart (specific and defensible), be human, look considered, feel earned. Never the CV's aesthetics.

## Data

`proofs` (including the arranged page draft), `proof_entries`, `proof_pages`, `files` (purpose `proof_photo`) ([data.md](../data.md)).

## Commands

| Command | Agent | What |
|---|---|---|
| `proof.create` | yes | A new space: title is enough |
| `proof.updateMeta` | yes | Title, role, dates, link |
| `proof.log` | yes | Add an entry: note, link, or photo |
| `proof.updateEntry` / `proof.removeEntry` | yes | Edit the log; remove confirms |
| `proof.arrange` | yes | Save the arranged story draft |
| `proof.publish` | yes | Snapshot the draft to a page at `/p/:slug`; later edits change nothing until republished |
| `proof.unpublish` | yes | Take the page down |
| `proof.remove` | yes | Destructive: confirm first |

## AI — the interviewer

The signature AI behaviour ([ai.md](../ai.md)). Two functions in `ai.server.ts`:

- **Interview**: given a Proof and its log, produce the next question that pulls a specific out of the user — what it was, what they did, what came of it. Questions, never answers; the user's words are the material.
- **Arrange**: shape the log into the three-part story using only facts present in the log and profile. No invented numbers, ever: "we shortened the intake process" is defensible; "cut time by 40%" that nobody measured is not.

## Coach behaviour

The Coach notices evidence in conversation ("we ran the club fair last week") and offers to log it. It runs the interview naturally in chat, logging answers as entries. It never publishes on its own and never polishes the raw log — the log is the user's, verbatim.

## Empty state

"Log what you're making." Below it, what already counts: a class project, a shift, an assignment, something that failed. A chip — "I don't have one yet" — asks the Coach to suggest candidates from the profile. Never required, never shame.

## Later, schema-ready

Vouches (a teammate or mentor confirms a Proof), invitations (invite someone to view or vouch through a `shares` token), reactions and discovery. These arrive as new commands and `shares` capabilities — additions, not rewrites.

## Out of scope now

Building vouch/invite UI, feeds, follows, comments. A Proof is not a blog and not a social post.
