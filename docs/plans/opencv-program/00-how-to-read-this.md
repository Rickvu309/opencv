## How to read this

One box is one unit of work. Every box names the evidence that checks it. A nested box is a sub-step of the box above it. Check a box only when its evidence exists, a file, a log line, a screenshot, a test run, or a SHA. The body is a how-to. The appendices explain and record.

The program runs `pstack/skills/poteto-mode/playbooks/autopilot-full.md` (local path `/home/quan/.claude/skills/poteto-mode/playbooks/autopilot-full.md`). Each PR owner squash-merges its own PR after the root's clean verdict. The operator's items that stop at merge-ready are PR-3, PR-11 and PR-17 (review-gated), plus the ops steps O1, O3 and O4 below, which the root runs only on an explicit go for each.

Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

Harness note. This program runs in Claude Code on one machine, not Cursor cloud. Owners and lanes are `Agent` subagents in their own git worktrees under `/home/quan/projects/opencv.worktrees/`. `control-ui` is not installed, so lanes drive the browser with the `agent-browser` skill, and from PR-15 onward through `.claude/skills/verify-opencv/SKILL.md`. Owners write code on `sonnet`. PR-3, PR-13 and PR-16 go to `opus`. Lanes run on `sonnet`.
