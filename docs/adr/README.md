# Architecture decisions

Locked choices for the rebuild. Do not reopen one inside a feature ticket; when a decision changes, add a new numbered file that supersedes the old one and say so in both.

| ADR | Decision |
|---|---|
| [0001](0001-modular-monolith-on-railway.md) | One codebase, two Railway services (web + worker), one Postgres |
| [0002](0002-command-bus.md) | Every write is a named command on a server-side bus shared by UI, Coach, and jobs |
| [0003](0003-relational-schema.md) | Relational schema; JSONB only for document bodies |
| [0004](0004-coach-in-process.md) | The Coach agent is an in-process module behind a strict boundary |
| [0005](0005-proof-own-domain.md) | Proof is its own domain beside Paper; sharing is a growth substrate |
| [0006](0006-port-opal.md) | Port Onyx Opal into `src/ui/` and Coach; do not install it; Storybook on Vercel |
| [0007](0007-opath-ui-in-repo.md) | Opath (Lab) is `packages/opath-ui` in this repo; not a second git remote |
| [0008](0008-published-proof-on-paper-cv.md) | A published Proof is a line on the Paper CV; no Add |

Format: context in two or three sentences, the decision, what it replaces or rejects, and the consequences. Keep each under a page.
