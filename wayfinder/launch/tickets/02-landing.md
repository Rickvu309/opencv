# The landing page: two doors, and the restraint stays

- **Type:** `wayfinder:prototype`
- **Status:** closed
- **Assignee:** minhquanvu3902@gmail.com (via Claude)
- **Blocked by:** [The waiting list: where an email actually goes](01-waiting-list.md)
- **Map:** [Map, OpenPath landing and the waiting list](../map.md)

## Question

`app/page.tsx` is 74 lines: a logo, a three-line heading, one paragraph, two buttons,
three feature words. It is calm and it reads well, and the instinct to keep it is right.

**The defect is not that it is simple, it is that both doors lead the same way.**
"Bắt đầu hành trình" goes to `/onboarding` and "Xem thử sản phẩm" goes to `/coach`. Both
are the product. A visitor who is interested but not ready has nowhere to go and leaves no
trace, which is the entire reason this map exists.

### 1. The two CTAs

Primary **"Dùng thử OpenPath"**, secondary **"Tham gia danh sách chờ"**. Preferred-first,
per `better-writing`. Two decisions inside that:

- **Where does the primary go**, `/onboarding` (the four-step flow, produces a profile the
  Coach can actually use) or `/coach` (straight to the conversation, which `PRODUCT.md`
  calls the product)? The current page offers both and this ticket collapses them to one.
- **What does the secondary do**, navigate to a separate page, or open the form in place?
  In place keeps the visitor on the page they were reading and costs no route. A separate
  page is easier to link to from outside.

### 2. The demo credential problem

The Coach now sits behind a sign-in (`components/coach/sign-in.tsx`) that prints the demo
credential on itself. So a visitor who clicks "Dùng thử OpenPath" meets a password form,
which is a strange second door. Decide whether the landing page mentions the demo account
up front, or whether meeting it at the Coach is fine because the credential is right there.

Related and worth checking rather than assuming: `/onboarding` and the other app screens
are **not** behind that door, only the Coach is. A visitor could complete the whole
onboarding flow and only hit the credential when they first speak to the Coach.

### 3. What must not change

The restraint. No hero-metric template, no identical card grid, no gradient text, none of
the anti-references in `PRODUCT.md`. The page earns its keep by being quiet. Vietnamese
tone marks need their line-height; the existing comments in `app/page.tsx` record why the
leading and the non-breaking space are what they are, and those decisions were measured.

## Resolution, 2026-08-04

Closed. Two doors on the deployed domain, and the restraint survived.

### 1, resolved: primary into onboarding, waiting list in place

**"Dùng thử OpenPath"** goes to `/onboarding` rather than `/coach`. Onboarding produces a
profile the Coach can actually use, so the visitor who takes the primary path arrives at
the conversation with something to talk about instead of a blank one.

**"Tham gia danh sách chờ"** opens the form **under** the buttons rather than navigating.
The visitor stays on the page they were reading, the primary action stays available to
someone who changes their mind, and no route is spent.

One thing the browser caught that the plan did not: joining flipped the "already joined"
flag, which unmounted the form **before it could show its own confirmation**, so a
successful submit read as "you were already on this list". The form now stays mounted once
opened, and the already-joined line is only for someone returning on a later visit.

### 2, resolved: the demo credential stays at the Coach

Checked rather than assumed: only `/coach` is behind the sign-in. `/onboarding`, `/profile`,
`/plan`, `/todo` and `/career-map` are all open. So the primary CTA leads to a real,
usable four-step flow with no password in the way, and the credential is met later, on the
screen that prints it. The landing page says nothing about a demo account, because
mentioning a password before anyone has seen anything is friction with no payoff.

### 3, what did not change

The heading, its measured leading, the one-sentence-per-line spans, and the non-breaking
space in "bắt đầu". I broke that space while rewriting the file and put it back; the
comment above it explains why it exists, and it was measured.

Nothing from `PRODUCT.md`'s anti-reference list appears: no hero-metric template, no card
grid, no gradient text.

### Verified on the deployed domain

375px and desktop: both CTAs present in preferred order, **zero** horizontal overflow,
**zero** offscreen elements, heading still one sentence per line with "bắt đầu" unbroken.
## Exit criterion

On the deployed domain at 375px and desktop: two CTAs in preferred order, the primary
reaching the product and the secondary reaching the waiting list. Nothing in
`PRODUCT.md`'s anti-reference list appears. The heading still holds one sentence per line
at both widths.
