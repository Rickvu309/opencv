# Implementation Plan: WO-48

**Work Order:** WO-48 - Add Application model, status transitions, notes and deadline actions

## Approach

`lib/applications/types.ts` holds the model and the transition rule; the actions
live in the registry beside everything else.

`rejected` is deliberately not a fifth stage on the same line as the four
forward ones: it can arrive from anywhere and it stops the progression, which is
a different shape. `FORWARD_STATUSES` is the line; `canTransition` is the rule.

## Decisions worth stating

- **Backward is free.** The reason for a backward move is always a correction,
  and a tracker that will not let you fix a misclick is a tracker people stop
  updating.
- **Coming back from `rejected` is allowed.** A company that said no and wrote
  again a month later is a real thing; the alternative is a duplicate row for
  one job.
- **An illegal move is ignored, not thrown.** A thrown dispatch surfaces to the
  user as "that change didn't go through" for a change that was never
  meaningful. The interface only offers legal moves, so this is the backstop
  rather than the mechanism.
- **One application per opening.** Two rows for one job is a tracker that
  disagrees with itself.
- **The next step is written down, not asked of a model.** The answer is the
  same for everybody at a given stage, so a model call to produce it would be
  slower, costlier and occasionally wrong. The Coach's version, which the
  tracker also offers, is the one that knows the person.
