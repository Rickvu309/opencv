create table users (
  id text primary key,
  email text not null,
  password_hash text not null,
  onboarding_completed_at timestamptz,
  notification_prefs jsonb not null default '{"deadline": true, "idle": true}'::jsonb,
  checklist_dismissed_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index users_email_lower on users (lower(email));
