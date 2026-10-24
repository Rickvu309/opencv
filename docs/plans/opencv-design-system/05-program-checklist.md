## Program checklist

### Arm the program

- [ ] State the protocol and this plan to the operator, then stop. Start execution only on the operator's explicit go.
- [ ] Read these from trunk at program start. Re-read them at every tick.
  - [ ] `/home/quan/.claude/skills/poteto-mode/playbooks/autopilot-full.md`
  - [ ] `/home/quan/.claude/skills/swarm/SKILL.md`
  - [ ] `git show origin/main:.claude/skills/verify-app-ui/SKILL.md` and `properties.md`
  - [ ] `git show origin/main:.claude/skills/verify-landing/SKILL.md`
  - [ ] `git show origin/main:.claude/skills/verify-opencv/SKILL.md`
  - [ ] `git show origin/main:AGENTS.md` and `/home/quan/AGENTS.md` "UI stack"
- [ ] Do not arm `/loop 1h`. The user's `AGENTS.md` forbids loops, sleeps and polling, so the audit tick runs on each harness wake with the tick prompt from `docs/plans/opencv-program/01-program-checklist.md`, verbatim. It posts a status message to the operator only for a tracked change.
- [ ] On the operator's hold, send every owner a zero-writes order at once.
- [ ] Tell both owners now. In remaining fix rounds, write `text-xs`, `text-sm`, `text-xl`, `text-3xl` and no `font-heading`, `text-micro`, `text-2xs`, `text-3xs`, `bg-success`, `bg-warning` or `pitch-tone` classes. Every such class they add now is a codemod hit in DS-1 or a rewrite in DS-4. #314's branch has 44 overlay hits under `features/pitch` against 43 on main (`git grep` on both refs), so it adds one net.

### Spawn owners

- [ ] One owner per PR, `sonnet` for code (repo cost rule), the full lifecycle from `scripts/new-task.sh` to `scripts/cleanup-worktree.sh`. Each PR starts from its own GitHub issue in `quanvu309/opencv`.
- [ ] Follow this dependency graph.
  - [ ] DS-1 starts after #308 and #314 merge, because its codemod and the `empty` rename touch `paper-workspace.tsx`, `pitch-workspace.tsx`, `pitch-showcase.tsx` and `cv-templates/*`, which both PRs edit.
  - [ ] DS-2 and DS-3 after DS-1. They are independent of each other.
  - [ ] DS-4a after DS-2, because it reuses the Confirmation pattern DS-2 copies into `apps/web/src/components/ai-elements/`.
  - [ ] DS-4b after DS-1. It is independent of DS-2, DS-3 and DS-4a.
  - [ ] DS-5 after DS-2, DS-3, DS-4a and DS-4b all merge.
- [ ] Hold the file boundaries. DS-2 touches `features/coach/**`, `features/home/**`, `components/ai-elements/**`, `styles/coach.css`. DS-3 touches `features/apply/**`. DS-4a touches `features/paper/**`, `styles/paper.css`. DS-4b touches `features/pitch/**`. Only DS-1 and DS-5 touch `packages/ui/src/styles/globals.css` and the governance tests, except that each surface PR deletes its own rows from the legacy allowlist.
- [ ] Hold the review gate. DS-1, DS-2, DS-3, DS-4a and DS-4b wait for the operator's review in chat with screenshots and a video.
- [ ] Hold the machine limit. At most three concurrent installs or test runs on the 8-core box, and one built worktree per head shared by that head's lanes.

### PR mechanics, for every PR

- [ ] Use `gh`. Open with `scripts/open-pr.sh --draft`, then `gh pr ready` once the quick check passes and the verify-opencv evidence is attached (repo `AGENTS.md` section 4). This repo's rule overrides the playbook's open-ready default.
- [ ] Run `scripts/check.sh --changed` before the PR-facing push. Push with hooks on, never `--no-verify`.
- [ ] Run `/deslop` before each commit and `/no-comments` before review.
- [ ] Rebase onto `origin/main` before the code-ready report, and again only at merge prep or on a conflict.

### Verdict and merge, for every PR

- [ ] A full swarm runs once at the code-ready head. One gates lane (`scripts/review-pr.sh`), the ten live lanes, the perf lane, and two audit lanes that read the diff and distrust the PR body. A rebase or a minor fix gets a single verifier at the new head.
- [ ] Clean only when every lane is `PASS`. A new head gets a fresh verdict.
- [ ] Merge rule from repo `AGENTS.md` section 6, `gh pr merge <pr#> --squash --admin` after `review-pr.sh` OK and a clean independent review, never on `HUMAN REQUIRED`.

### Boot recipe, for every live lane

- [ ] `git fetch origin <head-branch> && git checkout <head SHA>` in the shared lane worktree for that head.
- [ ] For app lanes, run the verify-app-ui checker as its `SKILL.md` says (PGlite stack, throwaway account, headless Chromium at 1440x900, 390x844 and reduced motion). For landing lanes, run verify-landing. For a driven flow, use verify-opencv.
- [ ] Deliver input only through `agent-browser` commands. Read-only diagnostics are the checker's JSON, the console log and `pnpm --filter web test`.
- [ ] Save every screenshot to `/home/quan/tmp/swarm-<pr-id>/worker-<n>/<slug>.png` and return the paths.

### Perf method, for every PR

- [ ] Metric A. Gzip bytes of each JS chunk in `apps/web/dist/assets` after `pnpm turbo build --filter=web --force`, reported as the entry chunk and the touched route chunk (routes are lazy since PR-9).
- [ ] Metric B. verify-app-ui 34 `first-render-budget` per route, in ms.
- [ ] Probe. Three builds and three checker runs per side, interleaved trunk then head, in two worktrees. Trunk baseline recorded first.
- [ ] Each PR's rule below names its budget. The budgets are rules set by this plan, not measurements.
