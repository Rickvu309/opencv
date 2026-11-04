# Brief rules

`scripts/ocv-tools.mjs brief <issue> --role build|mechanical|review|plan` prints the rules below that are tagged for the role (renumbered), the model for the role, the worktree, the port, the tool budget and the fenced paths. A lead pastes that output into an agent's brief instead of retyping the rules. Edit the rules here and every later brief carries the change. Each rule starts with its roles in brackets (`all`, or a list of roles) and ends with the AGENTS.md section it follows; `scripts/ocv-tools/brief.test.mjs` fails when a rule has no tag, cites a section AGENTS.md lacks, or drifts from the Git words AGENTS.md carries.

`scripts/ocv-tools.mjs done` lists this agent's open pull requests, held issues and worktrees. It exits 1 if any is unblocked, 4 if all remaining work is blocked, and 0 only if none remains. `scripts/ocv-tools.mjs block <issue> "<reason>"` records a blocker without completing work. This ownership check cannot prove the full user request is complete.

## Rules

```text
1. [build mechanical] Issue first. Work only on the issue named above. If Worktree above says none yet, run scripts/ocv-tools.mjs take <issue>. Work only in the worktree, use only the port in that worktree's .env, and never edit the main checkout or another agent's worktree. (AGENTS.md: Guardrails)
2. [all] Fenced paths. Never edit a path listed under Fenced paths, and list any offender you find there in your report instead. (AGENTS.md: Agent briefs)
3. [build mechanical] Finish in this turn. Continue all independent authorized work before yielding for an external dependency. A restriction on merging applies only to merging. If one decision truly blocks the remaining work, run scripts/ocv-tools.mjs block <issue> "<reason>", ask that one question, and say what you will do after the answer. (AGENTS.md: Agent briefs)
4. [review plan] Finish in this turn. Never end on a status line, a question or "want me to continue" while work is open. If one decision truly blocks you, ask that one question and say what you will do after the answer. (AGENTS.md: Agent briefs)
5. [build mechanical] Before you say you are done, run scripts/ocv-tools.mjs done. Exit 1 requires continuing unblocked work; exit 4 means blocked work remains incomplete; exit 0 means only that this agent owns no open work. Check every requested item against evidence before final handback. For a remaining check or review, use the host's watch and wake mechanism. (AGENTS.md: Agent briefs)
6. [all] Done means evidence: the command you ran and its real output, listed against each requested item. Check again means rerun the check and quote the new result. (AGENTS.md: Agent briefs)
7. [build mechanical] Git. Commit with scripts/ocv-tools.mjs save -m "<message>". Never use --no-verify, SKIP_CHECKS, --author or -c user.name. Add no AI attribution and no Co-Authored-By. Never push or commit to main. (AGENTS.md: Guardrails)
8. [review plan] Read only. Never edit a file, commit, push or open a pull request, and never claim or release an issue. Write your findings to the file your brief names. (AGENTS.md: Guardrails)
9. [build mechanical] No comments in any file you write, CSS and tests included. Explain with names or tests. (AGENTS.md: Agent briefs)
10. [build] A guard exports a pure detect, a mistake fixture that must fire and a clean fixture that must stay quiet, plus proof against a past commit that it fires on the old code and stays quiet on HEAD. (AGENTS.md: Agent briefs)
11. [all] Findings stay findings. A real bug outside your scope goes in your report under Findings with file:line, a repro and the lint idea. Never weaken a check to make it pass. (AGENTS.md: Agent briefs)
12. [all] Machine. Run one heavy command at a time. Run targeted tests, never the whole suite or pnpm check; CI does that. Never run sleep for over 30 seconds, never loop or poll to wait; background the job and let it wake you. Keep output bounded with head, tail, sed -n or grep -m. Scratch files go under the tmp folder in your home directory, never /tmp. (AGENTS.md: Agent briefs)
13. [build mechanical] Pull request. Write the body with the pr skill (Summary, Evidence, Merge Danger), with real commands and results and no machine-local paths. Run scripts/ocv-tools.mjs finish --body-file <file>. Replace a body with scripts/ocv-tools.mjs body <pr> --body-file <file> instead of gh pr edit --body-file. Merge only if your brief says so. (AGENTS.md: Per change)
14. [all] Subagents. Set the model on every spawn: haiku for search, exploration, polling and mechanical edits, opus for writing code, planning, architecture and review. (AGENTS.md: Agent briefs)
15. [all] Report. Write the full report to the file your brief names. Reply with one STATUS line, the pull request URL and the report path, under 1000 characters. (AGENTS.md: Agent briefs)
16. [build mechanical] After a merge, remove the worktree, the local branch and any throwaway folder you made, and list what you removed. (AGENTS.md: Agent briefs)
```

## Roles

| Role       | Model | Tool budget |
| ---------- | ----- | ----------- |
| build      | opus  | 60          |
| mechanical | haiku | 40          |
| review     | opus  | 40          |
| plan       | opus  | 40          |

## Fences

The fenced paths come from `docs/agents/brief-fences.json`. Each entry has an issue number and the paths agents must not edit while that issue is open. Each entry needs an `expires` date (YYYY-MM-DD); `brief` drops an entry after that date and says so.
