-- What the Coach actually did, and what the guards stopped.
--
-- ## Why two tables
--
-- They answer different questions. A trace answers "what did this turn cost,
-- how long did it take, and did the user keep the change". A violation answers
-- "what did the guards refuse, and were they right to". The second outlives
-- the first: a refusal is a case the conformance set replays long after the
-- turn that produced it stopped being interesting.
--
-- ## Why the spans are one jsonb column
--
-- A trace is always read whole. Nothing asks for one span of one turn, and a
-- row per span would buy a partial read nobody wants at the cost of a join on
-- every read. The same reasoning as `conversations`.

create table traces (
  id uuid primary key,
  -- Null is allowed and means the turn could not be attributed to an account.
  -- Better an honest anonymous trace than a wrong one.
  account_id uuid references accounts (id) on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz,
  duration_ms integer,
  -- The model the turn ran on, denormalised out of the spans so the common
  -- question ("which model was this") does not need a jsonb scan.
  model text,
  cost_usd numeric(12, 6),
  -- pending until the user accepts or undoes. See ADR-002: acceptance is a
  -- first-class quality signal, not a nice-to-have.
  outcome text not null default 'pending',
  spans jsonb not null default '[]'::jsonb
);

-- Both reads are "the newest ones, for this account", which is also the shape
-- the retention prune uses.
create index traces_account_started_idx on traces (account_id, started_at desc);

create table guardrail_violations (
  id uuid primary key,
  -- The turn it happened in, when there was one. Deliberately not a foreign
  -- key: the input guard fires before the turn has finished, so the trace it
  -- names does not exist yet and a reference would refuse the write at exactly
  -- the moment there is something worth writing. The link is diagnostic, and
  -- the account cascade below is what actually cleans these up.
  trace_id uuid,
  account_id uuid references accounts (id) on delete cascade,
  -- input or output: which guard raised it.
  guard text not null,
  -- The rule that fired, e.g. 'injection', 'out-of-scope', 'ungrounded-number'.
  rule text not null,
  -- block, revise, or flag.
  severity text not null,
  detail text not null,
  -- The offending text, truncated by the writer. Kept because a violation you
  -- cannot see is a violation you cannot judge.
  sample text,
  at timestamptz not null default now()
);

create index guardrail_violations_account_at_idx
  on guardrail_violations (account_id, at desc);
