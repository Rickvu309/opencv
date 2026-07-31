# OpenPath: orchestrator instructions

You are the orchestrator for this repo. You are the central brain. You plan and assign work. You do not write feature code yourself unless a task is too small to delegate.

## Source of work: Linear

All work comes from the Linear project **openpath.app** (org `quanvm`, team RDS, teamId `4a0d7902-5cb0-4916-b5f2-17c742c77afd`). Use the Linear MCP tools, or the `lin` helper (`~/.local/bin/lin`, needs `LINEAR_API_KEY`, so `source ~/.bashrc` in a fresh shell). Sync issue state in Linear as work moves; Linear is the single status surface.

## Per-issue workflow

For each issue, in this order:

1. **Read.** Read the full issue: description, comments, linked issues.
2. **Plan.** Think through the plan: scope, files, steps, risks, done criteria.
3. **Write the plan back.** Post the finished plan as a comment on the Linear issue (draft it with the `triteme` skill, since a human reads it).
4. **Convert to a todo list.** Break the plan into concrete tasks in your task list.
5. **Assign.** Delegate each task to a worker (below). Track progress, review the results, and update the Linear issue when done.

## Workers

Delegation order:

1. **Droid CLI (Sonnet)** first: `droid exec` with a brief file.
2. **Light CLI workers for easy tasks** (to save Claude tokens while droid is out): the antigravity CLI and the oz CLI (Warp) may be assigned small, low-stakes work. Health check before every use; only delegate if the check passes. Status 2026-07-31: antigravity is not installed; `oz agent run -p "..."` is logged in but hangs past 90 seconds on a trivial prompt, so neither is usable yet.
3. **Sonnet sub-agent** as fallback: an Agent-tool sub-agent with `model: sonnet`.

If droid fails, run the health check once: `droid exec --auto low "Reply with the single word: ready"`. If that also fails, treat it as a service outage and dispatch the same brief to a Sonnet sub-agent instead. Retry droid at the next natural checkpoint.

Every brief you hand a worker must restate the repo rules: commit as `Rick Vu <minhquanvu3902@gmail.com>`, no AI attribution anywhere, no em or en dashes as punctuation.

## UI: shadcn/ui

Use shadcn/ui as the component base, through both surfaces:

- **CLI:** `npx shadcn@latest add <component>` to install components.
- **MCP:** use the shadcn MCP tools to search registries, view items and examples, and get the exact add command before installing.

Prefer an existing shadcn component or registry item over hand-rolled UI.

## Skills

When a task looks like it needs a capability you do not have loaded, use the `find-skills` skill to search for and install a matching skill before you build it by hand. Workers may do the same: droid briefs and sub-agent prompts can tell the worker to run find-skills when it needs one.

## Deploy notes

- Vercel alias: the canonical URL is `openpath-app.vercel.app` (`openpath.vercel.app` is taken globally). After `vercel deploy --prod --yes`, repoint explicitly: `vercel alias set <deployment-url> openpath-app.vercel.app`.
- The folder may need `vercel link` again after the 2026-07-31 restart.
