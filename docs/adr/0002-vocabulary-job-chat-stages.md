# Jobs, Chats and the five Stages

**Status.** Accepted 2026-10-26.

**Context.** The product words were Opportunity, Thread, and Stages named Inbox, Prep, Sent, Live, Closed. The design says Job, Chat, and Stages named Saved, Applied, Interview, Offer, Closed. Inbox is a mail surface.

**Decision.** The product's words are Job, Chat and the five design Stages. Inbox is the mail surface and never a stage. Stage ids are `saved`, `applied`, `interview`, `offer`, `closed`. Code identifiers that still say `thread` or `opportunity` are renamed by the track that touches each file. `CONTEXT.md` is the source of truth for the words.

The release-one schema is `opencv_app`, created by a fresh baseline migration. `openpath_app` stays in production untouched for the operator to drop. No migration deletes data.

**Consequences.** `apps/api/drizzle` starts over with a fresh baseline migration in the schema `opencv_app`. Seed and starter data use the new words. Tests that assert the old stage headers change with them.
