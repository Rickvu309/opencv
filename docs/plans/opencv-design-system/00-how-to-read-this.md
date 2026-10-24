## How to read this

One box is one unit of work. Every box names the evidence that checks it. A nested box is a sub-step of the box above it. Check a box only when its evidence exists, a file, a log line, a screenshot, a test run, or a SHA. The body is a how-to. The appendices explain and record.

The program runs `pstack/skills/poteto-mode/playbooks/autopilot-full.md` (local path `/home/quan/.claude/skills/poteto-mode/playbooks/autopilot-full.md`), the same harness note as `docs/plans/opencv-program/00-how-to-read-this.md`. Each PR owner squash-merges its own PR with `gh pr merge <pr#> --squash --admin` only after `scripts/review-pr.sh` prints OK, the gates lane is green at the exact head, and an independent review has no open finding (repo `AGENTS.md` section 6). DS-1, DS-2, DS-3, DS-4a and DS-4b change what the person sees or does, so they stop at merge-ready for the operator's review in chat. DS-5 is not review-gated when its parity lanes pass.

When this plan is committed it splits into `docs/plans/opencv-ds/NN-*.md`, one file per section, each under the 20,000-byte cap, the same layout as `docs/plans/opencv-program/`.

Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

Two numbering facts the operator's brief got wrong, corrected here. `docs/adr/0013-remove-storybook.md` already exists, so the new ADR is **ADR-0014**. The type roles live in `apps/web/src/styles/paper.css`, not `apps/web/src/features/paper/paper.css`.
