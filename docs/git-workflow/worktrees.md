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

The worktree folder is `../<repo>.worktrees/<issue#>-short-description`, next to the main checkout.

## Start a task

```bash
cd ~/code/myapp                                       # any checkout of the repo works
scripts/new-task.sh feat 42 -d "login page"           # existing issue
scripts/new-task.sh fix "Cart total rounds wrong"     # creates the issue, then starts
```

The script:

1. Checks that the issue is open and not assigned to someone else, then assigns it to you (or creates it, labeled with the type).
2. Builds the branch name `type/<issue#>-short-description` and validates it.
3. Fetches `origin/main` and creates the branch and worktree from it, with no upstream yet.
4. Copies `.env.example` to `.env` in the worktree and sets `PORT`.
5. Installs dependencies (pnpm, yarn, or npm, detected from the lockfile). Skip with `--no-install`.
6. Turns on the local hooks for the clone: `git config core.hooksPath .githooks` (shared by all worktrees).
7. Prints the path, branch, and port.

Options: `-d` description, `-b` issue body, `--no-install`, `--no-assign`, `--take`. Run with `--help`.

When the work is ready for a PR, run `scripts/open-pr.sh --draft` inside the worktree.

## Rules

- One issue, one branch, one worktree. Git refuses to check out a branch that is already checked out in another worktree, which stops two agents from sharing a branch.
- The main checkout stays on `main`. Use it only to `git fetch`, run `new-task.sh`, and run `cleanup-worktree.sh`.
- Each worktree has its own `node_modules`. pnpm shares its package store between worktrees automatically, so it is the cheapest option.
- Each worktree has its own `.env`. Fill in real values by hand or from your secret store. Never commit it.
- Each worktree has its own dev server port. Only use the port in your worktree's `.env`.
- Don't put worktrees inside the repo folder.
- The review agent's throwaway worktrees (`review-pr-<n>`) live in the same folder and are removed by `scripts/review-pr.sh`.

## Ports

Port = `4000 + (issue# mod 1000)`. Issue 42 gets `4042`; issue 1042 also maps to `4042`, so the script moves to the next port that is free and not already claimed by another worktree's `.env`.

The 4000-4999 range avoids common local services (3000 default dev server, 3306 MySQL, 5432 Postgres, 6379 Redis).

Some dev servers read `PORT` from the shell, not from `.env`. Start them with the port explicitly:

```bash
PORT=4042 npm run dev
# or: npm run dev -- --port 4042
```

## Clean up after merge

```bash
cd ~/code/myapp
scripts/cleanup-worktree.sh --dry-run     # see what would go
scripts/cleanup-worktree.sh               # remove every merged worktree
scripts/cleanup-worktree.sh 42            # just issue 42
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

| Problem | Fix |
|---|---|
| `fatal: 'feat/42-...' is already checked out` | Someone else has that branch. Pick another issue. |
| Worktree folder was deleted by hand | `git worktree prune` |
| Port already in use | Check `.env` in your worktree; use the next free port and update `PORT` |
| Agent sandbox can't reach `../` | Allow the sibling `<repo>.worktrees/` folder in the agent's sandbox |
