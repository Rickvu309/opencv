# Delivery by pstack orchestrate, no operator review gate

**Status.** Accepted 2026-10-26.

**Context.** Earlier programs put the operator in a review gate on each PR. For release one the operator does not review. The program runs and merges.

**Decision.** Delivery is by pstack orchestrate. Each PR has one owner and merges on the root's clean verdict plus `scripts/review-pr.sh` OK. The repo's own gates stay. Every subagent runs on Grok. Owners and audits use `grok-4.7`. Verification lanes use `grok-4.7-build-fast`. There is no operator review gate. Three heavy jobs at most run on the build box. Superseded: heavy was removed in #591. A data-losing change still needs the `needs-human-review` label per `AGENTS.md`.

**Consequences.** The operator's items are external tasks, not merges. Those tasks are the Resend domain and the Google developer signup. A database change follows `docs/adr/0002-vocabulary-job-chat-stages.md` and does not delete production data.
