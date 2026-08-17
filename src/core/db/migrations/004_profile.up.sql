create table profiles (
  user_id text primary key references users (id) on delete cascade,
  name text not null default '',
  target_role text,
  location text not null default '',
  time_available text not null default '',
  summary text not null default '',
  updated_at timestamptz not null default now()
);

create table profile_facts (
  id text primary key,
  user_id text not null references users (id) on delete cascade,
  label text not null,
  value text not null
);

create table profile_experiences (
  id text primary key,
  user_id text not null references users (id) on delete cascade,
  org text not null,
  role text not null,
  date_from text not null default '',
  date_to text not null default '',
  detail jsonb not null default '[]'::jsonb
);

create table profile_education (
  user_id text primary key references users (id) on delete cascade,
  school text not null default '',
  major text not null default '',
  year text not null default '',
  gpa text not null default '',
  courses jsonb not null default '[]'::jsonb
);

create table profile_links (
  id text primary key,
  user_id text not null references users (id) on delete cascade,
  kind text not null check (kind in ('linkedin', 'github', 'portfolio')),
  url text not null,
  unique (user_id, kind)
);
