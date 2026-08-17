create table conversations (
  id text primary key,
  user_id text not null references users (id) on delete cascade,
  title text not null default 'New conversation',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table messages (
  id text primary key,
  conversation_id text not null references conversations (id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'tool')),
  content jsonb not null,
  created_at timestamptz not null default now()
);

create table ai_traces (
  id text primary key,
  user_id text not null references users (id) on delete cascade,
  kind text not null,
  model_role text not null,
  input_tokens int not null default 0,
  output_tokens int not null default 0,
  cost_usd numeric,
  duration_ms int not null default 0,
  tools jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table guardrail_events (
  id text primary key,
  user_id text references users (id) on delete cascade,
  kind text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
