create table proofs (
  id text primary key,
  user_id text not null references users (id) on delete cascade,
  title text not null,
  role text not null default '',
  date_from text not null default '',
  date_to text not null default '',
  link text not null default '',
  status text not null default 'logging' check (status in ('logging', 'published')),
  page_draft jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table proof_entries (
  id text primary key,
  proof_id text not null references proofs (id) on delete cascade,
  kind text not null check (kind in ('note', 'link', 'photo')),
  body text not null default '',
  url text not null default '',
  file_id text references files (id) on delete set null,
  created_at timestamptz not null default now()
);

create table proof_pages (
  proof_id text primary key references proofs (id) on delete cascade,
  user_id text not null references users (id) on delete cascade,
  slug text not null unique,
  content jsonb not null,
  published_at timestamptz not null default now()
);

create table handles (
  user_id text primary key references users (id) on delete cascade,
  handle text not null unique
);

create table shares (
  token text primary key,
  subject_type text not null,
  subject_id text not null,
  capability text not null check (capability in ('view', 'vouch', 'invite')),
  created_by text not null references users (id) on delete cascade,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
