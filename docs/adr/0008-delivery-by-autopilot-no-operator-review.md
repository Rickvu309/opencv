# Delivery by pstack autopilot, Grok owners, no operator review gate

**Status.** Accepted 2026-10-26.

**Context.** Earlier programs put the operator in a review gate per PR with screenshots and a video. For release one the operator said they do not review; the program babysits and merges.

**Decision.** Each PR has one owner and merges on the root's clean swarm verdict plus `scripts/review-pr.sh` OK, with the repo's own gates untouched. Every subagent runs on Grok through the T3 `delegate_task` tool, owners and audits on `grok-4.7` at the highest reasoning, verification lanes on `grok-4.7-build-fast`. Three heavy jobs at most on the build box. The decision trail lives in `docs/plans/opencv-program-trail/`.

**Consequences.** The plan's review-gate blocks become "None". The operator's items are external tasks (Resend domain, Google OAuth client and review), not merges. A data-losing change still needs the `needs-human-review` label per `AGENTS.md`, and a database reset in release one is allowed by 0002.
