# The hard-work mark

Fetched 15 Aug 2026. Primary sources only: official product docs, live sites, one archived capture of a sunset product, and that product's own wind-down notice. No listicles.

OpenPath context held while reading: `/u/[handle]` indexes published Proofs; `/p/[slug]` is one published Proof; the Proof space is where they log. Locked: a record, not a game — no streak, no score, no "keep it green," no feed, no follow. Not locked to a GitHub calendar. Audience is Vietnamese students and new grads; Proof is never required. Question owned by [Personal link](../issues/09-personal-link.md); the open slot is named in [spec.md → Proof space](../spec.md).

An earlier grill round (paper.md, round 12) had answered "a calendar of days they logged a Proof." This note treats that as reopened and argues against day granularity — see the recommendation.

For each mechanism: URL, what it shows, steal / reject, does it imply a game.

---

## 1. GitHub contribution graph

**URL:** [Contributions on your profile](https://docs.github.com/en/account-and-profile/concepts/contributions-on-your-profile), [Viewing contributions](https://docs.github.com/en/account-and-profile/setting-up-and-managing-your-github-profile/managing-contribution-settings-on-your-profile/viewing-contributions-on-your-profile), [Profile contributions reference](https://docs.github.com/en/account-and-profile/reference/profile-contributions-reference)

**What it shows.** Three stacked mechanisms, not one:

1. **A headline total.** The section is literally labeled "NUMBER contributions in the last year."
2. **The calendar.** One square per day, colored by count. Click a square for that day's work; shift-click a range (max one month). Private work can be shown as anonymized daily counts — the meter keeps ticking even when the work is hidden.
3. **"Contribution activity."** Below the calendar, a reverse-chronological timeline of the actual work — commits, pull requests, issues — with "important moments, like the date you joined an organization, proposed your first pull request, or opened a high-profile issue" *highlighted*. A year list on the right jumps you back through history.

The unit is an **app-usage event**: creating a repo always counts; commits, issues, PRs count under conditions (right email, default branch, not a fork). The graph records *that you used GitHub on a day*, not what the work was.

**Steal:** The timeline underneath, not the grid. "Important moments highlighted" is a record's voice — first Proof, the month two ran at once. Also: click a mark, land on the work. The mark must always be a door to real material.

**Reject:** The headline total (a score in a heading). Day-as-unit with a color intensity scale — that is the entire "keep it green" machine. Anonymized private counts — activity as a metric even when the content is withheld is pure meter. And the empty state: GitHub renders the full grey grid before you have done anything — a guilt object. A record with nothing recorded should show nothing.

**Game?** Yes, as read by the world — though the word "streak" appears nowhere in these three official pages. GitHub ships a count, a density calendar, and a timeline; streaks are a community reading built on the day-unit. The lesson is structural: **give people a daily unit and a visible gap, and they will invent the streak for you.** Vietnamese CS students know this grid from peers' profiles; reusing its shape invites a direct comparison OpenPath's sparse Proofs will always lose.

---

## 2. read.cv (sunset; archived capture)

**URL:** [Wayback capture of read.cv/andy, 17 Jan 2025](https://web.archive.org/web/20250117234545/https://read.cv/andy). Product is gone: per read.cv's own notice ([read.cv → "A new chapter"](https://read.cv/)), wind-down began 17 Jan 2025 (joined Perplexity), read-only 28 Feb, fully wound down 16 May 2025.

**What it shows.** A one-column profile: name, a one-line place ("Designer in West Berkeley"), About in first person. Then plain dated sections — **Work Experience** as `2021 — Now · role at org · city · one line`, **Projects** and **Side Projects** as `year · name · a sentence or two`, then Features, Education, Contact. Every entry is a **year or year-range plus a short human sentence**. There is not one number, meter, count, or graph on the whole page. Effort is read from the *ranges* ("2012 — 2016") and the accumulation of specific entries — a wedding matchbox zine sits two sections under a Director role and the page holds both.

**Steal:** The entry anatomy: date range · name · one line in their voice. Year-grouping as the only structure. Side work as first-class record. The quietest possible proof that dates + specificity carry "how hard" with zero chrome.

**Reject:** The CV taxonomy (Work Experience / Education / Contact) — `/u/[handle]` indexes published Proofs; it must not become a second CV (the CV is a Paper type that already exists). Also reject its fate as a caution: the product around the page died; the *page shape* is what survives.

**Game?** No. Nothing counts, nothing colors, nothing expires. The only pressure is that an empty section says nothing — and read.cv simply omitted empty sections.

---

## 3. Are.na channels

**URL:** [are.na/about](https://www.are.na/about), [help.are.na → Channels](https://help.are.na/docs/getting-started/channels.md), [help.are.na → Connections](https://help.are.na/docs/getting-started/connections.md), live profile [are.na/charles-broskoski](https://www.are.na/charles-broskoski)

**What it shows.** A channel is "a collection of content… made up of blocks and other channels" — the official pitch is to "save content, create collections over time and connect ideas." A block is one piece: image, link, text, file. Channels are open / closed / private. The live profile page renders an Info panel with a plain "Started 1 year ago." Effort on Are.na is read as **accumulation with a start date**: a channel that has been fed for six years *feels* like six years of attention, without a graph. And the official line on engagement: "there is no such thing as a 'like' or a 'favorite', instead we have connections" — a connection is someone filing your block into their own channel, provenance instead of applause.

**Steal:** "Collections over time" as the mental model — a Proof space already is one (notes, photos, files, links accumulating on one piece of work). "Started + still growing" as an honest two-timestamp signal. Refusing likes by design, and saying so.

**Reject:** Block counts anywhere near a heading — on OpenPath "12 proofs" instantly becomes the score. Connections as a visible tally. The channel *grid* as the index page — `/u/[handle]` is a person's record, not a wall of collections.

**Game?** No — deliberately. It is the strongest primary precedent that a record-keeping product can refuse scoring outright and remain legible for 15 years.

---

## 4. Linear Timeline (the roadmap shape)

**URL:** [linear.app/docs/timeline](https://linear.app/docs/timeline)

**What it shows.** "Display projects chronologically to track their progress, deadlines, and dependencies over time." Each **project is a named horizontal bar with a start and an end** on a shared time axis. The view "only surface[s] projects to keep project planning work cleanly separated from granular issue implementation" — spans, never the tick-level events. Resolution zooms week / month / quarter / year. Projects group by initiative; milestones mark checkpoints inside a span; optional properties decorate the bar: lead, priority, **status, health**, progress.

**Steal:** The core geometry — **a piece of work is a span, not a point.** Named bars on a year axis; overlap is visible (two bars at once = a heavy semester); a gap is just axis. Zoom-by-resolution right-sizes the same mark: a year strip on the index, one bar's neighborhood on a single page.

**Reject:** Everything decorating the bar: status, health, progress %, priority, dependencies. Also the tense — Linear points forward ("what's shipping and when"); OpenPath's mark points backward at finished, published work. A roadmap of *promised* Proofs would be a to-do list wearing a record's clothes.

**Game?** Mildly, in tool form — progress %, health, and deadline pressure are workplace scoring. Strip the properties and the naked geometry (named spans on time) carries no score at all.

---

## 5. frankchimero.com — the dated index

**URL:** [frankchimero.com/blog](https://frankchimero.com/blog/) (already in [reference-screens.md](reference-screens.md); re-read for the effort angle)

**What it shows.** 44 titles with dates, one column, newest first, 2009 → 2025. Re-reading for *effort*: density varies wildly and the page never comments — seven posts in 2010, two in a single February (2018), then a **four-year silence (Aug 2021 → Aug 2025)** sitting in the list with no visual penalty, followed by four posts in one autumn. The record holds bursts and silence as the same kind of fact. Sixteen years of dates *is* the hard-work mark; no chrome restates it.

**Steal:** Gap tolerance — the defining anti-streak property. A student's exam semester should read like Chimero's 2022: history, not failure. And the index-as-record: titles + dates may need no second mechanism at all.

**Reject:** Nothing here — except assuming a list alone gives a *glanceable* shape of effort. Sixteen years of titles carries its own weight; three Proofs need the shape made visible another way.

**Game?** No. There is nothing to keep alive.

---

## 6. rauno.me — sentence, projects, and the craft wall

**URL:** [rauno.me](https://rauno.me/), [rauno.me/craft](https://rauno.me/craft) (index already in [reference-screens.md](reference-screens.md))

**What it shows.** The index is one sentence and a short Projects list — identity carries no meter. The **/craft page is the effort mark**: ~70 small named pieces, each dated month + year, spanning Browser History (April 2021) to DD System (June 2026), some with a quiet outbound "View Prototype / View Production / Read Essay." No totals, no per-year headings, no graph. Five years of density is *felt* by scroll-length and date spread, never counted for you.

**Steal:** Accumulation as the proof — many small dated things beat one polished claim. The date worn quietly on each piece. The link out to the living work. Small works (a shift, a class assignment) are legitimate entries — exactly Proof's promise to students who "have no side projects."

**Reject:** Masonry-wall layout for `/u/[handle]` v1 — it suits 70 visual experiments, not 4 Proofs. No dates *sorted for you* anywhere — Rauno can afford disorder; a record page should not.

**Game?** No. Not even a count of pieces.

---

## What turns a record into a game

Cross-cutting, from the sources above — the mark implies a game exactly when:

1. **The unit is a day of app usage.** GitHub counts day-stamped usage events; day-units plus visible gaps is the streak machine, even though GitHub never ships a streak. Date the *work* instead (read.cv, Chimero, Rauno) and there is no daily unit to keep alive.
2. **A number sits in a heading.** "1,204 contributions" is a score wherever it appears. Are.na's refusal ("no such thing as a like") keeps every count out of the chrome.
3. **Intensity is colored.** The green scale converts more-per-day into more-virtue. Ink marks on a hairline carry when, without grading how much.
4. **Emptiness is rendered.** GitHub draws the whole grey grid before any work exists. A record shows nothing until there is something to record.
5. **It measures the behavior instead of the work.** Logging-frequency marks surveil the habit (and invite junk logging to feed the mark). Published work with its own dates cannot be gamed by opening the app.

---

## Recommendation: the span record

**One primary mark for `/u/[handle]`: published Proofs drawn as named spans on a quiet year axis** — Linear's naked geometry, wearing read.cv's anatomy, with Chimero's gap tolerance. Working name: **span record**. The grilling in [09-personal-link.md](../issues/09-personal-link.md) owns the final name.

**The page.** Identity as a sentence (Rauno). Then the mark: one hairline per year that contains work, each published Proof an ink span placed by its **role · dates** (already on every Proof per [spec](../spec.md)), title set on the span. A Proof with no dates sits as a tick at its publish date. Below, the index: the same Proofs as dated rows, year-grouped — `dates · title · a one-line why` (read.cv's entry anatomy, in their voice). Mark and index are one dataset at two densities; the span is a door to `/p/[slug]`. Years with nothing don't render — no grey grid, no shame rows. Zero published Proofs → no mark at all, just the sentence.

**Why spans and not the calendar (or the rest).**

- **Unit match.** A Proof is a piece of work with a duration — an experiment ran March–June, a shift job held all summer. GitHub's day-square fits commit-shaped work; a student publishing four Proofs a year would face 361 empty squares. Four spans on one line read as: two real months on one real thing, twice over, with a heavy overlapping April.
- **Structurally streak-proof.** No daily unit exists, so no streak can be counted — by anyone. Locked constraint satisfied by geometry, not by policy.
- **It measures the work, not the app.** Spans come from published Proofs' own stated dates — never from logging activity in private spaces. Nothing leaks, and junk-logging feeds nothing.
- **Gaps are axis.** An exam semester is empty hairline between named spans — Chimero's four silent years, not a broken chain.
- **"Cool / hard" lands in the right places.** Hard = duration and concurrency, visible at a glance. Cool = the titles and the pages themselves. The mark stays ink-on-hairline — no color scale, no totals ("4 proofs" never appears as a headline), consistent with the published page's craft bar.

**The fragment on `/p/[slug]`.** The **role · dates line the page already shows becomes drawable**: one hairline of that year, this Proof's span in ink, the person's other published Proofs as faint unlabeled ticks. One line tall, no legend, no numbers; tapping it goes to `/u/[handle]`. Right-sized because it reuses a line the page already owns — it whispers "ten weeks, inside a working year," which is the whole job. With no dates, the line stays text. The same strip may later sit on the Proof space header, moving live as they edit dates — the spec already allows the mark there.

**Rejected alternates.** Day-calendar of log-days (round 12's instinct): fails on unit mismatch, empty-grid shame, streak culture, and surveilling private logging. Counts-forward channel model: the count becomes the score. Index list alone with no mark: honest but not glanceable — and the spec asks for a mechanism in the heatmap's class, not only a list.

---

## Source list

Fetched or opened for this note:

- https://docs.github.com/en/account-and-profile/concepts/contributions-on-your-profile
- https://docs.github.com/en/account-and-profile/setting-up-and-managing-your-github-profile/managing-contribution-settings-on-your-profile/viewing-contributions-on-your-profile
- https://docs.github.com/en/account-and-profile/reference/profile-contributions-reference
- https://web.archive.org/web/20250117234545/https://read.cv/andy
- https://read.cv/ (the team's own "A new chapter" wind-down notice and schedule)
- https://www.are.na/about
- https://help.are.na/docs/getting-started/channels.md
- https://help.are.na/docs/getting-started/connections.md
- https://www.are.na/charles-broskoski
- https://linear.app/docs/timeline
- https://frankchimero.com/blog/
- https://rauno.me/
- https://rauno.me/craft

Not used as evidence: TechCrunch's acquisition story (corroborates the read.cv dates only); live read.cv profile pages (product wound down 16 May 2025 — hence the Wayback capture).
