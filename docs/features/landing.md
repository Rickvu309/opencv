# Landing

**Track:** Commodity. Clone [onyx.app](https://onyx.app/) marketing anatomy. Restyle to OpenPath tokens and [copy.md](../copy.md). Two doors: start now, or leave an email.

**Job:** A skeptical visitor decides to start, or leaves an email.

**Layout:** Public canvas at `/`. No signed-in chrome. Sticky public nav, then a centered hero with the product composer, then the waitlist, then a quiet footer ([layout.md](../design-system/layout.md)). Reference: [clone-sources.md](../design-system/clone-sources.md).

## Concept

Show the product after one promise. The Coach builds your CV, finds openings that fit, and names what is missing. You can change or undo every word. Who it is for: students and new graduates. No invented claims, testimonials, or statistics.

## Screens

- `/` — in order, cloned from onyx.app:
  1. Sticky nav, cloned from onyx.app: mark + OpenPath, Sign in (outline), Start now (primary).
  2. Hero: who it is for, the promise, the product composer, then a 360px phone-shaped card of the published Proof at `/p/demo` (date, two sentences, Copy link). Header keeps Sign in / Start now.
  3. Waitlist, then footer (mark, year, Sign in, Start now).
- Primary: Start now (`/sign-up`). Sign in is outline. The card under the composer is the published Proof; the sentences open `/p/demo`.
- Fast on a mid-range Android phone: CSS grid background only. No animation walls, logo ticker, or video.

## Copy

- Headline: "Build your CV and find openings that fit"
- Who: "For students and new graduates"
- Composer placeholder: "Write to the Coach"
- Under the composer: the `/p/demo` card. No extra title. Copy link copies the public URL.
- Waitlist: "Leave your email." / "If you are not starting now, we will write when there is news." Join. Placeholder `you@email.com`. "You're on the list. We'll email you."
- Waitlist errors: "Enter an email." / "That did not go through. Try again."

## Mechanics

Waitlist submit is a public server function (no session, so not a bus command). A valid email lands in `waitlist` and confirms. An email already on the list gets the same confirmation. A store failure says the submission did not complete. Validation errors name the fix. The hero composer does not talk to the Coach. It is a door into sign-up.

## Data

`waitlist` ([data.md](../data.md)).

## Out of scope

Pricing, blog, testimonials, customer logos, invented win rates, multi-page marketing site, language switcher.
