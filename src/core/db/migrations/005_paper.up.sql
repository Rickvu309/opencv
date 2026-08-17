create table papers (
  id text primary key,
  user_id text not null references users (id) on delete cascade,
  kind text not null check (kind in ('cv', 'letter')),
  title text not null,
  template text not null default '',
  language text not null default 'en',
  content jsonb not null default '{}'::jsonb,
  source_paper_id text references papers (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table files (
  id text primary key,
  user_id text not null references users (id) on delete cascade,
  purpose text not null check (purpose in ('upload', 'proof_photo')),
  filename text not null,
  mime text not null,
  size int not null,
  bytes bytea not null,
  paper_id text references papers (id) on delete set null,
  created_at timestamptz not null default now()
);
