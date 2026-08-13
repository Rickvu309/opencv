# Implementation Plan: WO-61

**Work Order:** WO-61 - Build subscription backend: Plan model, checkout, webhook reconciliation

## Approach

A `plans` table, not a field on `app_state`. Different writer, different trust:
the user must not be able to set their own tier by posting a state, and the
Coach has no business seeing a billing status.

**No card data anywhere.** The provider owns it; this stores a subscription
reference and nothing else, which is what the blueprint's delegate-payment ADR
asks for.

**The provider is the authority.** Checkout does not set a tier; the webhook
does, after verifying an HMAC signature. A missing webhook secret is a refusal
rather than a bypass, because a public endpoint that grants paid plans is worse
than one that is down.

**A failed payment is not an instant downgrade.** The provider retries a bounced
card, and dropping somebody to free the moment one payment fails would take away
a plan they are about to keep paying for. `past_due` is recorded; the revert
happens at the period boundary if the subscription really ended (AC-MON-005.2).

**Cancelling keeps what was paid for** until `periodEnd`, then reverts. That is
applied on read rather than by a nightly job, so there is no window in which the
database disagrees with what the user is owed.

**Without a provider configured**, checkout refuses with 503 and the user keeps
their plan and is told (AC-MON-002.3). A checkout that silently succeeded
without taking money would put somebody on a tier they are not paying for.
