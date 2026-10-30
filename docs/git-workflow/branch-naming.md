# Branch naming

## Format

```
type/<issue#>-short-description
```

Examples: `feat/42-login-page`, `fix/57-cart-total`, `hotfix/88-checkout-500-error`, `chore/91-bump-node-22`.

## Rules

- `type` is one of the six below. Nothing else.
- `<issue#>` is the GitHub issue number. It is always required.
- `short-description` is lowercase kebab-case, 3-5 words, letters and digits only.
- Branch from the latest `origin/main`. Never branch from another task branch.
- One issue = one branch. Need a second branch? Create a sub-issue.

| Type       | Use for                              | Issue form             |
| ---------- | ------------------------------------ | ---------------------- |
| `feat`     | New features, user-visible changes   | Feature                |
| `fix`      | Bug fixes                            | Bug                    |
| `hotfix`   | Urgent production fixes              | Bug (relabel `hotfix`) |
| `refactor` | Code changes with no behavior change | Chore                  |
| `chore`    | Dependencies, config, tooling        | Chore                  |
| `docs`     | Documentation only                   | Chore                  |

## Allowed exceptions

Bot branches are allowed without an issue: `dependabot/...` and `renovate/...`.

## Enforcement

The local **pre-push hook** (`.githooks/pre-push`) refuses to push any other name, and refuses any push to `main`. It's on once `git config core.hooksPath .githooks` is set (`scripts/ocv-tools.mjs take` does this). The `ci` check does not check the name. Hooks can be skipped with `--no-verify`, and a skipped hook is not caught again at merge.

The hook uses:

```
^(feat|fix|hotfix|refactor|chore|docs)/[0-9]+-[a-z0-9]+(-[a-z0-9]+)*$
^(dependabot|renovate)/
```

| Branch               | Result                 |
| -------------------- | ---------------------- |
| `feat/42-login-page` | OK                     |
| `feat/login-page`    | Fails: no issue number |
| `feature/42-login`   | Fails: unknown type    |
| `feat/42-Login-Page` | Fails: uppercase       |
| `feat/42_login_page` | Fails: underscores     |
| `fix/42`             | Fails: no description  |

More than 5 words is a guideline, not a failure.

## Wrong name?

Rename the branch on GitHub (open PRs follow), then `git branch -m old new` in your worktree. Create branches with `scripts/ocv-tools.mjs take <issue#> -d "short description"`.
