## Agent skills

### Issue tracker

Issues live in the Linear project **OpenPath**. See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context (`CONTEXT.md` + `docs/adr/` at repo root). See `docs/agents/domain.md`.

### Git

- `main` is the only long-lived branch; keep it mergeable.
- One Linear ticket → one branch `<type>/<issue-id>-<slug>` (`feat` / `fix` / `chore`) from updated `main`.
- Parallel frontier work: one git worktree per ticket.
- Blocked tickets start only after their blockers are on `main`.
- Commit on the current branch; a human merges, pushes, and removes the branch/worktree.

### Design system

UI kit: absorb-when-possible, shadcn-style `packages/ui`, Storybook catalog. Run `pnpm dlx shadcn@latest add <name> -c apps/web`. Import through `@workspace/ui/components/<name>` and `@workspace/ui/globals.css`. See `docs/adr/0002-design-system.md`.
