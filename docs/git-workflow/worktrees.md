# Worktrees

A worktree is an extra working folder for the same repo, checked out on its own branch.
Several agents on one machine each get their own folder, so they never overwrite each other's files.

- **Agents: required.** Every task runs in its own worktree.
- **People: optional.** Useful when you juggle two or more issues.

## Layout

```
~/code/myapp/                          # main checkout: stays on main, never edited
~/code/myapp.worktrees/
    42-login-page/                     # feat/42-login-page,  PORT=4042
    57-cart-total/                     # fix/57-cart-total,   PORT=4057
```

The worktree folder is `../opencv.worktrees/<issue#>-short-description`, next to the main checkout.

## Start a task

```bash
cd ~/code/myapp                                       # any checkout of the repo works
scripts/ocv-tools.mjs take 42 -d "login page"           # existing issue
scripts/ocv-tools.mjs take "fix: Cart total rounds wrong" --what ... --done ... --risk low   # files the issue, then starts
```

A title with no type prefix needs `--type`: `scripts/ocv-tools.mjs take "Cart total rounds wrong" --type fix --what ... --done ... --risk low`.

The script:

1. Checks that the issue is open and not assigned to someone else, then assigns it to you (or creates it, labeled with the type).
2. Builds the branch name `type/<issue#>-short-description` and validates it.
3. Fetches `origin/main` and creates the branch and worktree from it, with no upstream yet.
4. Copies `.env.example` to `.env` in the worktree and sets `PORT`.
5. Installs dependencies (`pnpm install --frozen-lockfile`). Skip with `--no-install`.
6. Turns on the local hooks for the clone: `git config core.hooksPath .githooks` (shared by all worktrees).
7. Prints the path, branch, and port.

Options: `-d` branch words, `--type` (`feat`, `fix`, `hotfix`, `refactor`, `chore`, `docs`), `--no-install`, `--no-assign`, `--take`, `--resume`. A new title takes the same fields as `file`: `--what`, `--done`, `--risk`, `--could-go-wrong`, `--questions`, `--out-of-scope`, `--details`. `--body-file <path>` replaces those fields. Every command and flag is listed by `scripts/ocv-tools.mjs help`.

`--resume` checks out a branch an idle holder already pushed (`scripts/ocv-tools.mjs take 42 --resume`) and records your claim. A local branch that is behind that push is fast-forwarded. A local branch that has diverged is refused, with a Fix line, so the pushed commits are not dropped. Without `--resume`, take refuses that branch and prints the resume command.

When the work is ready for a PR, run `scripts/open-pr.sh --draft` inside the worktree.

## Rules

- One issue, one branch, one worktree. Git refuses to check out a branch that is already checked out in another worktree, which stops two agents from sharing a branch.
- The main checkout stays on `main`. Use it only to `git fetch`, run `ocv-tools.mjs take`, and run `ocv-tools.mjs cleanup`.
- Each worktree has its own `node_modules`. pnpm shares its package store between worktrees automatically, so it is the cheapest option.
- Each worktree has its own `.env`. Fill in real values by hand or from your secret store. Never commit it.
- Each worktree has its own dev server port. Only use the port in your worktree's `.env`.
- Don't put worktrees inside the repo folder.

## Ports

Port = `4000 + (issue# mod 1000)`. Issue 42 gets `4042`; issue 1042 also maps to `4042`, so the script moves to the next port that is free and not already claimed by another worktree's `.env`.

The 4000-4999 range avoids common local services (3000 default dev server, 3306 MySQL, 5432 Postgres, 6379 Redis).

`pnpm dev` loads the worktree `.env`. The api listens on `PORT` and the web dev server on `PORT + 1000` (4042 and 5042 for issue 42). The web's API URL, the api's allowed web origin and its auth URL default from the same `PORT`. Set `VITE_API_URL`, `WEB_ORIGINS` or `AUTH_URL` explicitly to override (Railway does).

## Clean up after merge

```bash
cd ~/code/myapp
scripts/ocv-tools.mjs cleanup --all --dry-run   # see what would go
scripts/ocv-tools.mjs cleanup --all             # remove every merged worktree
scripts/ocv-tools.mjs cleanup 42              # just issue 42
```

It removes a worktree only when its PR is merged (checked with `gh`; without `gh`, when the remote branch was deleted). It skips worktrees with uncommitted changes unless you pass `--force`. It then deletes the local branch and runs `git worktree prune`.

By hand:

```bash
git worktree list
git worktree remove ../myapp.worktrees/42-login-page
git branch -D feat/42-login-page          # -D because squash-merges don't look "merged" to git
git worktree prune
```

## Troubleshooting

| Problem                                       | Fix                                                                                                          |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `fatal: 'feat/42-...' is already checked out` | Someone else has that branch. Pick another issue.                                                            |
| Worktree folder was deleted by hand           | `git worktree prune`                                                                                         |
| Web calls the wrong api or CORS fails         | An older `.env` may still set `VITE_API_URL` or `WEB_ORIGINS`; delete those lines so they derive from `PORT` |
| Port already in use                           | Check `.env` in your worktree; use the next free port and update `PORT`                                      |
| Agent sandbox can't reach `../`               | Allow the sibling `opencv.worktrees/` folder in the agent's sandbox                                          |
