# Free and Pro, Coach tiers behind Pro, usage as percentages

**Status.** Accepted 2026-10-26. Supersedes archived ADR-0009 and the budget line of archived ADR-0007.

**Context.** Archived ADR-0009 made Light and Max selectable by anyone with daily caps of 50, 30 and 10 from the server. The design shows two plans, Free ($0) and Pro ($9 a month), Light and Max marked Pro, caps in the copy of 20, 10 and 5 a day, and usage shown as percentages for the current session and the week. No payment provider exists and the operator does not want one in release one.

**Decision.** Two plans, Free and Pro, stored on the profile. Light and Max need Pro. "Upgrade to Pro" is a full screen per the design whose button is a placeholder; Pro is granted by hand. Caps are configuration, not code, with the design's 20, 10 and 5 as defaults. Usage is shown as percentages of the cap for the session and the week, never as credit numbers. The Coach usage model (what a session is, when the week resets, what Pro's "unlimited" means next to per-tier caps) is redesigned by the Coach track and recorded in its own ADR before that track merges.

**Consequences.** `COACH_DAILY_TURN_LIMIT_*` defaults change. A `plan` column and a usage endpoint with reset times are added. Billing shows invoices and a payment method as empty states.
