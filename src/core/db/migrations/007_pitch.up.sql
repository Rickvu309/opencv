create table pitch_items (
  id text primary key,
  user_id text not null references users (id) on delete cascade,
  kind text not null check (kind in ('bio', 'intro', 'answer')),
  prompt text not null default '',
  body text not null,
  language text not null default 'en',
  updated_at timestamptz not null default now()
);

create unique index pitch_one_bio on pitch_items (user_id) where kind = 'bio';
create unique index pitch_one_intro on pitch_items (user_id) where kind = 'intro';
