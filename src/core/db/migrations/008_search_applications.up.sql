create table openings (
  id text primary key,
  user_id text not null references users (id) on delete cascade,
  title text not null,
  company text not null default '',
  location text not null default '',
  url text not null default '',
  raw_text text not null,
  requirements jsonb not null default '[]'::jsonb,
  fit jsonb,
  created_at timestamptz not null default now()
);

create table applications (
  id text primary key,
  user_id text not null references users (id) on delete cascade,
  opening_id text references openings (id) on delete set null,
  role text not null,
  company text not null default '',
  status text not null check (status in ('interested', 'applied', 'interviewing', 'offer', 'rejected')),
  notes text not null default '',
  deadline date,
  cv_paper_id text references papers (id) on delete set null,
  letter_paper_id text references papers (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
