# Data

Postgres is the only datastore. Everything lives in the `openpath` schema. Relational tables per domain; JSONB only where the content is genuinely a document body ([ADR 0003](adr/0003-relational-schema.md)).

## Principles

- The schema documents the product. A new contributor or agent should be able to read the table list and understand what OpenPath is.
- Every user-owned row carries `user_id` and every query is scoped by it. There is no cross-user read outside the share substrate.
- JSONB is for document bodies (a CV's blocks, a letter's paragraphs, a published Proof snapshot) and for payloads (job inputs, notification data). Never for relations or lifecycle state.
- Growth hooks are reserved columns and enums, not speculative tables. The `shares.capability` enum is the door future mechanics walk through.

## Tables

### Identity and auth

| Table | Holds |
|---|---|
| `users` | `id`, `email` (unique on `lower(email)`), `password_hash`, `onboarding_completed_at`, `notification_prefs` JSONB, `created_at` |
| `sessions` | `id` = SHA-256 of the cookie token (never the token), `user_id`, `created_at`, `expires_at` (30 days when remembered, 1 day when not; remembered sessions renew on activity) |

### Profile

| Table | Holds |
|---|---|
| `profiles` | One row per user: `name`, `target_role` (nullable — "not sure yet" is honest), `summary` |
| `profile_facts` | Label/value context rows the Coach grounds on |
| `profile_experiences` | `org`, `role`, `date_from`, `date_to`, `detail` JSONB (result lines) |
| `profile_education` | `school`, `major`, `year`, `gpa`, `courses` JSONB |
| `profile_links` | `kind` (`linkedin`, `github`, `portfolio`), `url` |

### Paper (commodity)

| Table | Holds |
|---|---|
| `papers` | `kind` (`cv`, `letter`), `title`, `template` (situation), `language`, `content` JSONB (block structure), `source_paper_id` (set on tailored copies), timestamps |
| `files` | Bytes a user brought or added: `purpose` (`upload`, `proof_photo`), `filename`, `mime`, `size`, `bytes` (bytea, ≤5 MB). Referenced by paper uploads and Proof photo entries |

### Proof and share (signature)

| Table | Holds |
|---|---|
| `proofs` | `title`, `role`, `date_from`, `date_to`, `link`, `status` (`logging`, `published`), `page_draft` JSONB (the arranged story before publishing), timestamps |
| `proof_entries` | The running log, newest first: `kind` (`note`, `link`, `photo`), `body`, `url`, `file_id`, `created_at` |
| `proof_pages` | One live published snapshot per proof: `slug` (unique), `content` JSONB (`words`, `date`, and only the arranged parts that exist — missing “came of it” stays missing), `published_at` |
| `handles` | `user_id`, `handle` (unique; name plus a short id, editable in Settings) |
| `shares` | `token` (unique), `subject_type`, `subject_id`, `capability` (`view` now; `vouch`, `invite` reserved), `created_by`, `expires_at`, `created_at` |

### Pitch, search, application (commodity)

| Table | Holds |
|---|---|
| `pitch_items` | `kind` (`bio`, `intro`, `answer`), `prompt` (answers only), `body`, `language`. One `bio` and one `intro` per user |
| `openings` | `title`, `company`, `location`, `url`, `raw_text` (as pasted), `requirements` JSONB (extracted lines), `fit` JSONB (score with per-requirement met/missing, so the number always shows its working) |
| `applications` | `opening_id` (nullable), `role`, `company`, `status` (`interested`, `applied`, `interviewing`, `offer`, `rejected`), `notes`, `deadline`, `cv_paper_id`, `letter_paper_id`, timestamps |

### Coach and trust

| Table | Holds |
|---|---|
| `conversations` | `title`, `last_message_at`, timestamps. History sorts by `last_message_at`. |
| `messages` | `conversation_id`, `role` (`user`, `assistant`, `tool`), `content` JSONB (parts: text, reasoning, tool-call, tool-result), `created_at` |
| `command_log` | Every write: `actor` (`user`, `coach`, `system`), `name`, `input` JSONB, `inverse` JSONB (command name + input, null when not undoable), `undone_by` (log id), `conversation_id` (when a Coach turn caused it), `created_at` |
| `ai_traces` | Per turn or task call: `kind`, `model_role`, token counts, `cost_usd`, `duration_ms`, `tools` JSONB |
| `guardrail_events` | `kind`, `detail` JSONB, `created_at` |

### Plumbing

| Table | Holds |
|---|---|
| `notifications` | `kind`, `payload` JSONB, `read_at` |
| `jobs` | Queue: `kind`, `payload` JSONB, `run_at`, `attempts`, `locked_at`, `locked_by`, `failed_at`, `error` |
| `waitlist` | `email` (unique), `created_at` |

Deleting a user cascades everything they own. Published Proof pages and shares die with their owner; there is no orphaned public content.

## The command log and undo

Every command handler returns `{ result, inverse }`. The bus appends a `command_log` row inside the same transaction, so a write and its record cannot diverge. Undo executes the logged inverse through the bus as a normal command and sets `undone_by` on the original row. Not everything is undoable — auth and publishing external side effects log `inverse: null` and the UI says so instead of pretending.

The log is also a product surface: it is how the app can truthfully show "the Coach updated your CV at 21:14" with an undo button, which is what makes giving the Coach hands trustworthy.

## Migrations

Numbered pairs in `src/core/db/migrations/`:

```
001_users.up.sql
001_users.down.sql
```

- Both halves required. The runner refuses a missing half, a shared number, or a name that does not match the pattern.
- Never edit an applied migration; the runner stores a checksum of each `up` file and stops if it changed. Write a new pair.
- `npm run db:migrate`, `db:status`, `db:rollback` act on whatever `DATABASE_URL` points at and print the host and schema first.
- On deploy, the web process applies pending migrations before it listens. A failed migration fails the deploy rather than serving a broken app.

## Tests

Tests that touch the database create a throwaway schema (`test_<random>`), run, and drop it. They skip when `TEST_DATABASE_URL` is absent. Fixtures are built by executing commands through the bus, never by inserting rows, so tests exercise the real write path.
