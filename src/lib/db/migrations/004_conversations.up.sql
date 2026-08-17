-- The account's Coach threads.
--
-- ## Why a separate table from `app_state`
--
-- They are written at different moments and for different reasons: `app_state`
-- changes when the user edits their profile or plan, this changes while they
-- are talking. Sharing a row would mean every keystroke in a CV rewriting the
-- whole chat history, and every chat turn rewriting the whole profile, under
-- last-write-wins. Two rows, two writers, no interference.
--
-- ## Why the whole list in one document
--
-- The list is bounded and always read whole: the sidebar shows every
-- conversation, and opening one needs its events. A row per conversation would
-- buy a partial read nothing asks for, and cost a transaction to keep the cap.

create table conversations (
  account_id uuid primary key references accounts (id) on delete cascade,
  -- The same array the browser kept, newest first, under the same caps.
  list jsonb not null,
  updated_at timestamptz not null default now()
);
