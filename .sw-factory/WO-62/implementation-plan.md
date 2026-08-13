# Implementation Plan: WO-62

**Work Order:** WO-62 - Build Coach usage metering and allowance enforcement

## Approach

Counted at the eve channel's `onMessage`, after the input guard and before the
model: a turn refused here has cost nothing.

**Only Coach turns are metered.** AC-MON-004.4 asks that the user's own tools
keep working, and the reason is not generosity: somebody who has run out of
Coach turns still has an application due on Friday, and locking their CV over it
would deserve to lose them. Nothing else in the product passes through this
door, so that property holds by construction rather than by a check.

**The refusal has something to say.** `allowanceMessage` names what ran out,
when it comes back, and what to do. "Limit reached" on its own leaves somebody
guessing whether the product is broken.

**The increment is in SQL**, not read-modify-write, so two turns starting at
once cannot both read the same count.

**An upgrade resets usage to zero.** Carrying it across would sell somebody a
bigger plan and hand them a bill they had already spent.
