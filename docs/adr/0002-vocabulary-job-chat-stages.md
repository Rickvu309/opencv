# Jobs, Chats and the five Stages

**Status.** Accepted 2026-10-26.

**Context.** The glossary said Opportunity, Thread, and Stages named Inbox, Prep, Sent, Live, Closed. The design says Job, Chat, and Stages named Saved, Applied, Interview, Offer, Closed, and it uses Inbox for a new mail surface.

**Decision.** The product's words are Job, Chat and the five design Stages. Inbox is the mail surface and never a stage. The database follows the words. Stage ids become `saved`, `applied`, `interview`, `offer`, `closed`. There is no data migration, because release one has no users to protect. The operator chose to reset the database instead. Code identifiers (`thread`, `opportunity`, old stage ids) are renamed by the track that touches each file, and the glossary in `CONTEXT.md` is the source of truth.

**Consequences.** `apps/api/drizzle` starts over with a fresh baseline migration in the Apply and Coach tracks. Seed and starter data use the new words. Tests that assert the old stage headers change with them.
