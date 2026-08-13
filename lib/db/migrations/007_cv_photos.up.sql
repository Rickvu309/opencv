-- The photo on a CV.
--
-- ## Why not inside `app_state`
--
-- The same argument that gave conversations their own table, only sharper. A
-- photo is tens of kilobytes; `AppState` is about five, and it is written on
-- every keystroke in a CV line and sent to a database on another continent.
-- Putting the image in the document would multiply the cost of every edit by
-- the size of a picture that changed once.
--
-- ## Why the bytes are here and not in blob storage
--
-- The waiting list uses Vercel Blob and the argument there was that a few
-- hundred addresses need no schema. This is the opposite case: the image
-- belongs to exactly one account, must disappear with that account, and must
-- never be readable by URL to anyone else. A foreign key and a cascade give all
-- three for free. A blob store would need its own access rule, and getting that
-- wrong publishes somebody's face.

create table cv_photos (
  account_id uuid not null references accounts (id) on delete cascade,
  -- The CV this belongs to, as its id inside that account's state. Not a
  -- foreign key: resumes live in a jsonb document, so the database cannot
  -- check it, and the read path is scoped by account anyway.
  resume_id text not null,
  image bytea not null,
  mime text not null,
  updated_at timestamptz not null default now(),
  primary key (account_id, resume_id)
);
