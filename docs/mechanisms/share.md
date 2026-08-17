# Public identity and sharing

Evidence wants an audience the user controls. Share is the substrate: pages for published work, a personal page that quietly proves a span of effort, and a capability model that lets every future social mechanic — vouches, invitations, private views — arrive as an addition instead of a rewrite. It is deliberately built before the social layer, so the social layer will have honest bones.

## Why this exists

A Proof that only its author can see changes how they feel; a Proof they can hand to a recruiter changes what happens next. But this audience must be user-owned: the target user is anxious, and one privacy surprise — something public they did not choose — ends trust permanently. So sharing is a mechanism with rules, not a checkbox on other features. And because invitation and social mechanics are on the roadmap, the substrate has to be designed now: retrofitting capabilities onto ad-hoc public URLs is how products end up with three permission systems.

## Principles

1. **Nothing is public by default.** Publishing is an explicit act with a visible result and an unpublish that works instantly.
2. **The user owns distribution.** Their links, sent by them, where they choose. No feed, no follow, no algorithmic reach — a page is reached by being given.
3. **Snapshots, not live views.** A shared link shows what was published, exactly; edits change nothing until the user republishes. A link never shifts under its reader.
4. **The record is work, not activity.** The personal page proves a span of real output — never app usage, streaks, or a contribution grid to keep green.
5. **No vanity metrics in public.** Nothing on a page counts likes or views to visitors. Credibility comes from specifics and, later, named vouches.

## The mechanic

### Objects

| Object | What it is |
|---|---|
| Handle | The user's public name: name plus a short id by default, editable in Settings, unique |
| Proof page | `/p/:slug` — one published Proof, frozen at publish time, with an OG image so the link looks considered in a chat |
| Personal page | `/u/:handle` — name, one line, and the **span record**: published Proofs by role and dates |
| Share token | A `shares` row: token, subject, capability, optional expiry — the unit every future mechanic is built from |

### The span record

The personal page's centerpiece, and a deliberate rejection of the GitHub-style day grid. A contribution graph measures activity and manufactures guilt; the span record measures work: each published Proof as a row — role, dates, title — reading like the truthful skeleton of a CV that happens to be backed by evidence. A visitor learns in five seconds that this person makes things and finishes them. The author feels their record grow without ever being told to keep a streak alive.

### The capability model

Every grant of access is a `shares` row with a capability:

| Capability | Status | What it grants |
|---|---|---|
| `view` | v1 | Public pages — the implicit grant behind `/p/:slug` and `/u/:handle` |
| `vouch` | reserved | A named person may confirm one Proof |
| `invite` | reserved | A scoped door: view before publishing, a private employer view |

Adding a mechanic means a new capability value, new commands on the bus, and a spec — the token plumbing, revocation, and expiry already exist. This is the whole point of the substrate: the first vouch ships as a feature, not a permissions project.

### Honest edges

An unpublished page 404s immediately and plainly ("This page isn't published."). A dead handle 404s the same way. Revoking a token kills it now, not at cache expiry. Public routes carry no app chrome, load fast on a bad connection, and render fully without JavaScript — a recruiter on a phone is the design target.

## The AI inside it

None. Share is deliberately mechanical — publishing, tokens, and rendering have no model in the loop. The AI's contribution to a public page happens upstream in Proof, under Proof's grounding rules.

## Connection points

Proof (publish and unpublish write `proof_pages`; pages render here), Settings (handle management), Paper (a CV may reference a published Proof by its public link), the bus (every grant and revocation is a logged, undoable command). Future vouches will also touch notifications ("Minh confirmed your Proof").

## Growth roadmap

- **v1** — handle, personal page with span record, Proof pages with OG images, instant unpublish.
- **v-next: vouches.** The user sends a `vouch` token to someone who was there; that person confirms in one tap, no account required; the page shows "Confirmed by Minh — team lead, club fair." Named, specific, unfakeable at any scale that matters.
- **v-next: private views.** An `invite` token scoped to one audience: an employer sees a Proof the world cannot, a mentor sees a draft before publishing.
- **v-later: the personal page grows up.** Ordering, a one-paragraph introduction, maybe a chosen accent — the user curates; the product never auto-composes their identity.
- **v-later, only if earned: discovery.** Any move beyond user-owned distribution happens under these same principles or not at all.

## What would kill it

- **A privacy surprise.** One thing public that the user did not explicitly publish, once.
- **Metric anxiety.** Public counts, rankings, or anything that makes a two-Proof page feel like losing.
- **Fakeable credibility.** Anonymous endorsements or bulk vouches would poison the one thing vouches are for.
- **SEO-spam energy.** If `/u/` pages start reading like keyword farms, recruiters stop opening them.

## Success signals

- Published Proofs per user, and repeat publishing — the substrate is worth using.
- Visits to `/p/` and `/u/` pages from outside the app — links are actually being sent.
- Handle customization rate — the page feels like theirs.
- Later: vouch completion rate (tokens sent that get confirmed) — the credibility loop closes.
