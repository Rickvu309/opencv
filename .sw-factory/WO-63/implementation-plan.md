# Implementation Plan: WO-63

**Work Order:** WO-63 - Build plans and billing UI in Settings

## Approach

Server-rendered, because the plan is not in `AppState`: not the Coach's
business, not the browser's to write. It is read on the server and handed down.

The usage bar leads, before the three plans. Somebody deciding whether to pay
should be looking at how much of the free allowance they actually used, not at
a feature grid built to make the free column look thin.

A cancelling plan says so and shows when it ends; a past-due one says a payment
did not go through. Both are states the user can act on, and neither is a
number in a table.
