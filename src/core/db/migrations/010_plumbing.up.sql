create table notifications (
  id text primary key,
  user_id text not null references users (id) on delete cascade,
  kind text not null,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table jobs (
  id text primary key,
  kind text not null,
  payload jsonb not null default '{}'::jsonb,
  run_at timestamptz not null default now(),
  attempts int not null default 0,
  locked_at timestamptz,
  locked_by text,
  failed_at timestamptz,
  error text,
  created_at timestamptz not null default now()
);

create table waitlist (
  email text primary key,
  created_at timestamptz not null default now()
);
