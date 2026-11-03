# Brief rules

`scripts/ocv-tools.mjs brief <issue> --role build|mechanical|review|plan` prints the rules block below, the model for the role, the worktree, the port, the tool budget and the fenced paths. A lead pastes that output into an agent's brief instead of retyping the rules. Edit the rules here and every later brief carries the change; `scripts/ocv-tools/brief.test.mjs` fails when the output drops a rule.

`scripts/ocv-tools.mjs done` is the other half. It lists this agent's open pull requests, held issues and worktrees and exits 1 while any has no recorded blocker. `scripts/ocv-tools.mjs block <issue> "<reason>"` records one.

## Rules

```text
1. Issue first. Work only on the issue named above. Run scripts/ocv-tools.mjs take <issue>, work only in the worktree it prints, and use only the port in that worktree's .env. Never edit the main checkout or another agent's worktree.
2. Fenced paths. Never edit a path listed under Fenced paths, and list any offender you find there in your report instead.
3. Finish in this turn. Never end on a status line, a question or "want me to continue" while work is open. If one decision truly blocks you, run scripts/ocv-tools.mjs block <issue> "<reason>", ask that one question, and say what you will do after the answer.
4. Before you say you are done, run scripts/ocv-tools.mjs done. It exits 1 while you hold an open pull request, a held issue or a worktree with no recorded blocker. Close each one it lists, or record the blocker.
5. Done means evidence: the command you ran and its real output, listed against each requested item. Check again means rerun the check and quote the new result.
6. Git. Commit with scripts/ocv-tools.mjs save -m "<message>". Never use --no-verify, SKIP_CHECKS, --author or -c user.name. Add no AI attribution and no Co-Authored-By. Never push or commit to main.
7. No comments in any file you write, CSS and tests included. Explain with names or tests.
8. A guard exports a pure detect, a mistake fixture that must fire and a clean fixture that must stay quiet, plus proof against a past commit that it fires on the old code and stays quiet on HEAD.
9. Findings stay findings. A real bug outside your scope goes in your report under Findings with file:line, a repro and the lint idea. Never weaken a check to make it pass.
10. Machine. Run one heavy command at a time. Run targeted tests, never the whole suite or pnpm check; CI does that. Never run sleep for over 30 seconds, never loop or poll to wait; background the job and let it wake you. Keep output bounded with head, tail, sed -n or grep -m.
11. Scratch files go under the tmp folder in your home directory, never /tmp.
12. Pull request. Write the body with the pr skill (Summary, Evidence, Merge Danger), with real commands and results and no machine-local paths. Run scripts/ocv-tools.mjs finish --body-file <file>. Merge only if your brief says so.
13. Subagents. Set the model on every spawn from the role table: haiku for search, exploration and polling, sonnet for writing code and mechanical edits, opus for planning, architecture and review.
14. Report. Write the full report to the file your brief names. Reply with one STATUS line, the pull request URL and the report path, under 1000 characters.
15. After a merge, remove the worktree, the local branch and any throwaway folder you made, and list what you removed.
```

## Roles

| Role       | Model  | Tool budget |
| ---------- | ------ | ----------- |
| build      | sonnet | 60          |
| mechanical | haiku  | 40          |
| review     | opus   | 40          |
| plan       | opus   | 40          |

## Fences

The fenced paths come from `docs/agents/brief-fences.json`. Each entry has an issue number and the paths agents must not edit while that issue is open. The list is empty by default.
