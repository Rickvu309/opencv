create table command_log (
  id text primary key,
  user_id text not null references users (id) on delete cascade,
  actor text not null check (actor in ('user', 'coach', 'system')),
  name text not null,
  input jsonb not null,
  inverse jsonb,
  undone_by text references command_log (id),
  conversation_id text,
  created_at timestamptz not null default now()
);

create index command_log_user_id on command_log (user_id, created_at desc);
