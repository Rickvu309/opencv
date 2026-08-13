# Implementation Plan: WO-46

**Work Order:** WO-46 - Build output grounding guard against profile facts
**Requirements:** REQ-TRUST-001
**Blueprints:** AI Guardrails, Trustworthy Coach

## Problem

A cover letter that says "reduced processing time by 40%" when nobody measured
it. The user does not notice, because it is the kind of thing they might have
done, and they find out in the interview. Everything this product writes is
written to be taken into a room and defended, which makes an invented number
worse than a missing one.

## Approach

One file, `lib/guardrails/grounding.ts`, checking two things that can actually
be checked.

### `profileFacts(state)`

Everything the product knows about the user, flattened to one lowercase string:
identity, context rows, experience, education and courses, document labels,
every résumé section and entry, and the papers and pitch items the user has
written. A bag of text rather than a structure, because the question is "does
this appear anywhere in what they told us" and every structured version of that
is the same search with more steps.

The papers and pitch bodies count as fact deliberately: the user wrote them, so
a Coach repeating a line back is not inventing anything.

### The number check (AC-TRUST-001.2)

A *measurable result*, not a number. "Three months from now" and "two projects"
are numbers and neither is a claim about what the user achieved. What counts:
a percentage, a money amount, or a quantity attached to a verb of improvement
(tăng, giảm, rút ngắn, increased, reduced, saved). Getting that line right is
the whole difference between a guard and an irritation.

Comparison is by parsed value, not by digits. `userSaid` carries the
conversation, because "or supplied by the user" is half the criterion and the
half that makes the guard usable.

### The claim check (AC-TRUST-001.1 and .3)

Assertions of fact about the user: "bạn đã làm ở X", "you worked at X", "your
experience with X". Only forms that state something as already true; "bạn có
thể học SQL" is advice and states nothing. The named subject has to appear in
the facts.

### Revise, not block

Same reasoning as WO-43: the reply has streamed by the time the check can run.
The correction names the doubt rather than deleting the sentence, because the
user is the only one who knows whether it is true and they are about to use it.

### Out of scope, deliberately

Market claims. There is no retrieved corpus in this version to check them
against; ADR-002 says so, and leaving it undone is more honest than checking it
badly.

## Testing

Every case has a partner proving the guard stays quiet on a good reply:

- an invented 40% is caught; a 40% the user supplied is not; a GPA already in
  the profile is not
- ordinary numbers in advice are not treated as results
- an employer the user never had is caught; the one they did have is not
- advice is not a claim
- what the user wrote about themselves counts as fact

## Risks

- **False positives**, again the real failure mode. The measurable patterns are
  narrow and each has a negative test.
- **Substring matching** can be fooled by a short subject. Stopwords cover the
  common empty ones ("công ty", "the job") and the minimum subject length is
  two characters.
