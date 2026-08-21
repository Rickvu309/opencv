# User feedback → tickets (research)

**Question:** How should OpenPath let Users send feedback that auto-becomes tickets for the founder/agents to triage?

**Context:** Solo founder, Linear already the issue tracker (team QVE, project OpenPath), Vietnamese early-career Users, platform still bootstrapping. Desired shape: User submits → auto receive → feedback ticket → human or agent looks later (no live reply chat).

## Options compared

| Approach | Fit for OpenPath now | Notes |
|----------|----------------------|--------|
| **In-app form → API → Linear `issueCreate`** | **Best** | Matches desired pipeline; uses existing tracker; agents already work Linear. |
| Linear [Asks](https://linear.app/docs/linear-asks) (Slack/email/web forms) | Partial | Built for *internal* / org requests and CX; web forms + sync exist, but not a first-class in-product Coach UX. Asks + Customer Requests from integrations are plan-gated (Business+ for Asks). |
| Linear [Customer Requests](https://linear.app/docs/customer-requests) | Later | Links feedback to issues with customer attributes; shines with Intercom/Zendesk/Front. API can create customers/needs, but model is org/B2B-centric; consumer Gmail domains are excluded from auto customer mapping. |
| Canny / Featurebase / Frill | Weak now | Public voting + roadmap. Conflicts with “evidence over trend-chasing”; adds another product surface and cost before you have volume. |
| Intercom / full support inbox | Too early | Support product, not “signal for build.” Expensive; no CX team. |

## What mature teams do (and what to steal)

Linear’s own CX loop ([CX in Linear](https://linear.app/now/cx-in-linear)): meet Users where they are → **templates** that separate **bugs** vs **feature requests** → land in **triage** → keep the **User’s exact words** on the issue → close the loop later. They treat feedback as a **whetstone for intuition**, not a vote tally ([Building what customers need](https://www.linear.app/now/building-what-customers-need)).

Steal for OpenPath: typed intake (bug vs idea vs Coach quality), quote the User verbatim, `needs-triage`, no public voting board.

## Technical feasibility (Linear)

- Create issues via GraphQL `issueCreate` (teamId + title required; description, labels, project optional). Official docs: [GraphQL](https://linear.app/developers/graphql).
- With Triage enabled on the team, new issues can land in Triage automatically.
- Server-side only: API key in Railway env, never in the web client.

## Recommendation for OpenPath

1. **Product:** Thin **Feedback** channel — not a first-class domain area like Paper. One in-app entry → type + free text → “Thanks, we got it.” No User-facing ticket status/history yet.
2. **Pipeline:** `apps/web` form → `apps/api` → Linear `issueCreate` on team **QVE**, labels e.g. `feedback` + `needs-triage`, body includes verbatim text + auto context (route, optional User id, timestamp, app version).
3. **Types (day one):** Bug / Product idea / Coach was unhelpful / Other — mirrors Linear’s bug vs request split without a helpdesk.
4. **Timing:** Spec **after** platform wiring (web + API live). Don’t block Paper/Opportunity.
5. **Defer:** Canny-style boards, Intercom, Customer Requests org model, in-app reply threads, screenshot capture (add when volume hurts).

## Open decisions (for grill)

- Exact UI placement (global vs Coach-adjacent).
- Whether anonymous submit is allowed before auth exists.
- Whether feedback issues sit in project OpenPath or a dedicated “Inbox” view only.

## Sources

- https://linear.app/docs/customer-requests
- https://linear.app/docs/linear-asks
- https://linear.app/now/cx-in-linear
- https://www.linear.app/now/building-what-customers-need
- https://linear.app/developers/graphql
