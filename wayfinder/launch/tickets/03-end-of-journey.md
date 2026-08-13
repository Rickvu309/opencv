# The end of the journey: ask when the value has landed

- **Type:** `wayfinder:grilling`
- **Status:** closed
- **Assignee:** minhquanvu3902@gmail.com (via Claude)
- **Blocked by:** [The waiting list: where an email actually goes](01-waiting-list.md)
- **Map:** [Map, OpenPath landing and the waiting list](../map.md)

## Question

"At the end of the journey they can type their email." The best moment to ask is after
the product has proved something, not before. But this app has no end: the Coach is a
loop, the plan is ongoing, and `PRODUCT.md` wants users back weekly. So "the end" has to
be defined before it can be built.

### 1. When has the value landed?

Candidates, each observable in code today:

- **Onboarding completes.** `app/onboarding/page.tsx` commits eight actions and routes to
  `/profile`. The visitor has just done work and immediately sees it reflected. Earliest
  honest moment.
- **The Coach answers for the first time.** The product's actual promise, delivered once.
- **A Coach edit lands.** The moment the thing does something *for* them, which is the
  claim the whole design rests on.

Pick one. Asking at more than one is asking twice.

### 2. What it must not be

- Not a modal over the conversation. `PRODUCT.md` principle 4 is "calm under uncertainty",
  and these users open the app anxious and between classes.
- Not a blocker. Every path through it must be dismissible and must stay dismissed.
- Not a second ask if they already joined from the landing page. The client knows whether
  this browser has joined; use it.

### 3. The copy carries this one

At the landing page the ask is "join a list". Here it is "you have seen what this does,
want to know when it is real". Same list, different sentence, and the second one has
earned more. Vietnamese, `PRODUCT.md` voice, per `better-writing`.

## Resolution, 2026-08-04

Closed.

### 1, resolved: when onboarding finishes

The earliest honest moment. The visitor has just answered four screens and is looking at
the profile those answers produced, so the product has demonstrated something. The two
later candidates were rejected for the same reason: waiting for the Coach's first answer
means many visitors are never asked at all, and the Coach is behind a sign-in.

Onboarding already redirects on a 1800ms timer, so the ask lives on the screen it lands
on, not on the finishing screen it leaves. It is triggered by a flag rather than a `?new=1`
parameter, because a parameter survives in the address bar, in a shared link and in a
reload long after the moment has passed.

### 2, resolved: a strip, not a modal

A dismissible bar above the profile content. Not a modal, per `PRODUCT.md` principle 4:
these users open the app anxious and between classes. Dismissal is stored, so it sticks
across reloads. Someone who joined from the landing page is **never** shown it, because
asking twice for the same thing reads as not listening.

### 3, the copy

Landing: "Để lại email, có chỗ trống là mình báo bạn ngay." Here: "Đây mới là bản demo.
Bạn vừa thấy OpenPath làm được gì." Same list, different sentence, and the second one has
earned more.

### Verified

| Check | Result |
| --- | --- |
| `/profile` without onboarding | No ask |
| `/profile` after onboarding | Ask appears, with field and dismiss button |
| Dismiss, then reload | Stays dismissed |
| Already joined at the landing | Never asked |
| Submit | Lands on the same list, tagged `end-of-demo` |
## Exit criterion

On the deployed domain: complete the chosen moment and the ask appears once, in place,
dismissible. Dismiss it and it stays dismissed across a reload. Submit it and the address
lands on the same list as the landing page, tagged with where it came from.
