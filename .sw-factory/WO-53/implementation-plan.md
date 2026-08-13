# Implementation Plan: WO-53

**Work Order:** WO-53 - Build the weekly check-in retention nudge

## What runs, and what honestly does not

The selection runs: which accounts have gone quiet for a week and are still
inside sixty days. It is scheduled on the runner, keyed by ISO week so it fires
once however often the schedule runs.

**Nothing is sent.** There is no email sender wired in this product, and
pushing a notification to somebody who never asked for one is the kind of growth
tactic this product's voice rules out. Inventing a channel is a bigger decision
than a background job should make on its own.

That is not a placeholder dressed up. The selection is the part with the
judgement in it and the part worth testing; the moment a channel exists this
becomes one more `step()` rather than a feature. The alternative, shipping a
send path against a provider nobody has chosen, would be worse: untested code
whose first real run is aimed at users.

`isoWeek` is used rather than "week of the year" because the latter gives two
different answers either side of 1 January, and the weekly job would run twice
or not at all.
