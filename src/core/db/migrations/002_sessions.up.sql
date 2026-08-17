create table sessions (
  id text primary key,
  user_id text not null references users (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index sessions_user_id on sessions (user_id);
