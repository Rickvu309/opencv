# Triage Labels

The skills speak in terms of five canonical triage roles. Only one of them is a label here. The others are read from the issue and its pull requests, so nothing has to be set or cleared by hand.

| Role in mattpocock/skills | In this tracker                                                                                          |
| ------------------------- | -------------------------------------------------------------------------------------------------------- |
| `needs-triage`            | The issue has no PR yet (`gh pr list --search "<issue#> in:body"` is empty).                             |
| `needs-info`              | The body lacks the Goal, Acceptance or Proof the Task form asks for. Ask in a comment.                   |
| `ready-for-agent`         | The body has Goal, Acceptance and Proof, and no open PR closes it.                                       |
| `ready-for-human`         | The label `ready-for-human`. `scripts/new-task.sh` and `scripts/open-pr.sh` refuse an issue that has it. |
| `wontfix`                 | `gh issue close <n> --reason "not planned"`.                                                             |

The labels in `.github/labels.yml` are the type labels, `needs-human-review`, and `ready-for-human`. `node scripts/pr.mjs doctor` lists any other label on GitHub.

When a skill mentions a role, use the entry in this table.
