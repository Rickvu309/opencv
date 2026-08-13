-- Background work that survives a restart.
--
-- ## Why a table and not a queue service
--
-- There is already one Postgres, it is already the thing that must be up for
-- the product to work, and a second piece of infrastructure to run four
-- scheduled jobs would be a second thing to pay for, monitor and remember. The
-- durability this needs (a step that completed stays completed across a
-- redeploy) is a row, and Postgres is very good at rows.

create table jobs (
  id uuid primary key,
  -- Which workflow this is a run of, e.g. 'weekly-check-in'.
  kind text not null,
  -- The caller's own key. Two enqueues with the same key are one job, which is
  -- what stops a cron that fires twice from sending two emails.
  idempotency_key text not null,
  -- queued, running, done, failed.
  status text not null default 'queued',
  -- Whatever the workflow needs to run. Small by contract: this is a pointer
  -- to work, not the work itself.
  input jsonb not null default '{}'::jsonb,
  -- The steps that have already completed, by name, with what they returned.
  -- This is the durability: a resumed run reads this and skips them.
  completed_steps jsonb not null default '{}'::jsonb,
  attempts integer not null default 0,
  -- Never run before this. Backoff moves it forward; a schedule sets it ahead.
  run_after timestamptz not null default now(),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One live job per key. A finished job does not block the next one with the
-- same key, which is what lets a weekly job use the week as its key.
create unique index jobs_idempotency_key on jobs (kind, idempotency_key);

-- The claim query: the oldest job that is due and not finished.
create index jobs_due_idx on jobs (status, run_after) where status in ('queued', 'running');
