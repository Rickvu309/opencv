# Free and Pro, Coach tiers behind Pro, usage as percentages

**Status.** Accepted 2026-10-26.

**Context.** The server lets anyone pick Light and Max, with daily caps of 50, 30 and 10. The design shows two plans, Free at $0 and Pro at $9 a month. Light and Max are marked Pro. The copy shows caps of 20, 10 and 5 a day. Usage is a percentage for the current session and for the week. No payment provider exists.

**Decision.** Two plans, Free and Pro, are stored on the profile. Light and Max need Pro. Free routes to OpenRouter free models. Pro routes to Claude through the AI SDK Anthropic provider. Caps are configuration, with 20, 10 and 5 as the defaults. Usage is shown as percentages of the cap for the session and the week, never as a credit number. Upgrade to Pro is a placeholder. Pro is granted by hand.

**Consequences.** The daily turn limit defaults change to 20, 10 and 5. A plan column and a usage endpoint are added. Billing shows invoices and a payment method as empty states.
