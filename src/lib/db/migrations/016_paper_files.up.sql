-- Uploaded CV and cover-letter files. Same argument as paper_photos: the
-- bytes belong to one account, must vanish with it, and must not be readable
-- by URL to anyone else.

create table paper_files (
  account_id uuid not null references accounts (id) on delete cascade,
  upload_id text not null,
  bytes bytea not null,
  mime text not null,
  file_name text not null,
  updated_at timestamptz not null default now(),
  primary key (account_id, upload_id)
);
