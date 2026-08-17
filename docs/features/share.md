# Share

**Track:** Signature — the substrate OpenPath's sharing, invitation, and social mechanics grow on ([ADR 0005](../adr/0005-proof-own-domain.md)). This spec is operational; the design itself lives in [mechanisms/share.md](../mechanisms/share.md), which outranks this spec on intent.

**Job:** give a user's real work an audience they control: a published Proof page anyone can open, a personal page that quietly proves a span of work, and — later — invitations and vouches on the same rails.

## Concept

Two public surfaces now, one growth mechanism underneath.

- **`/p/:slug`** — one published Proof: the designed page, exactly as it was at publish time (a snapshot, so later edits change nothing until republished). The one expressive surface in the product. An OG image makes the link look considered when sent in a chat or posted.
- **`/u/:handle`** — the personal page: name, one line, and the **span record** — published Proofs by role and dates. A record of real work over time, not a contribution graph, not app-activity days, no streaks, no scores, no "keep it green".
- **`shares`** — the mechanism: a token names a subject and a capability. Today the only capability is `view` (public pages). `vouch` and `invite` are reserved: "invite a teammate to confirm this Proof" or "give this employer a private view" become new rows and new commands, not new systems.

No feed, no follow, no likes. Distribution is the user sending their own link.

## Screens

- `/p/$slug`, `/u/$handle` — public routes in `_public/`, no app chrome, fast, indexable, honest 404s ("This page isn't published."). OG image route per Proof page.
- Handle management surfaces in Settings; publish and unpublish live in Proof.

## Data

`handles`, `shares`, and `proof_pages` (owned by Proof, rendered here) ([data.md](../data.md)).

## Commands

| Command | Agent | What |
|---|---|---|
| `share.setHandle` | no | Name plus a short id by default; editable; uniqueness enforced kindly |
| `share.create` | no | Reserved shape for tokened shares (private views, invites). Not surfaced in v1 UI |
| `share.revoke` | no | Kill a token |

## Privacy stance

Nothing is public by default. Publishing is an explicit act with a visible result and an unpublish that works. A dead slug 404s immediately. The personal page shows only published Proofs, never profile facts, never activity.

## Later, on these rails

Vouches (capability `vouch`: a named person confirms a Proof), invitations (capability `invite`), employer views, and whatever socialization earns its place — each a new capability value and commands, inheriting undo, audit, and Coach awareness from the bus.

## Out of scope now

Feeds, follows, comments, likes, discovery pages, analytics dashboards (a simple view count on the user's own page is acceptable later; surveillance is not).
