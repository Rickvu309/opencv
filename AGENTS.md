## Agent skills

### Issue tracker

Issues live in the Linear project **OpenCV**. See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context (`CONTEXT.md` + `docs/adr/` at repo root). See `docs/agents/domain.md`.

### Git

- `main` is the only long-lived branch; keep it mergeable.
- One Linear ticket → one branch (any name) from updated `main` → one PR that references the QVE id.
- CI green and a review verdict before a human squash-merges.
- `ready-for-human` tickets are decisions; implementation agents never pick them up.
- Parallel frontier work: one git worktree per ticket.
- Blocked tickets start only after their blockers are on `main`.
- Commit on the current branch; a human squash-merges, then removes the branch/worktree.

### Design system

UI kit: absorb-when-possible, shadcn-style `packages/ui`, Storybook catalog. Run `pnpm dlx shadcn@latest add <name> -c apps/web`. Import through `@workspace/ui/components/<name>` and `@workspace/ui/globals.css`. Colocate `*.stories.tsx` next to each absorbed primitive and import the component from its source file. Local catalog: `pnpm storybook`. App code uses semantic tokens only — no raw hex or named Tailwind palette classes (`bg-red-500`) outside the two ADR-0010 exceptions (CV print paper, tokenized GitHub heatmap). Prefer kit components over raw `<button>`/`<input>`/`<textarea>`/`<select>`. See `docs/adr/0002-design-system.md` and `docs/adr/0010-design-tokens-and-governance.md`.
