-- One account's whole `AppState`, as it left the reducer.
--
-- ## Why one document rather than tables
--
-- `lib/actions/persistence.ts` already made this argument for the browser: the
-- registry is a pure reducer over one value, and last-write-wins is correct
-- while one person edits in one place. Nothing about moving the value to a
-- server changes that. What a column-per-field schema would buy is querying
-- across accounts, which no requirement asks for, at the price of a migration
-- every time an action learns a new field. The blob is about 5KB.
--
-- ## Why the row is optional
--
-- An account exists from the moment it is created; its state does not exist
-- until something is dispatched. The absent row is the honest way to say "this
-- account has written nothing yet", and the read path turns that into the seed.

create table app_state (
  -- Primary key and foreign key at once: exactly one state per account, and it
  -- disappears with the account rather than outliving it as an orphan.
  account_id uuid primary key references accounts (id) on delete cascade,
  state jsonb not null,
  updated_at timestamptz not null default now()
);
