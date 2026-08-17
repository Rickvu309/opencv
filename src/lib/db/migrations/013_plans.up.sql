-- What the account pays for, and what it has used.
--
-- ## Why a table rather than a field on `app_state`
--
-- `app_state` is the document the Coach can read and the browser can write.
-- A plan is neither: the user must not be able to set their own tier by
-- posting a state, and the Coach has no business seeing the billing status.
-- Different writer, different trust, different table.
--
-- ## What is deliberately not stored
--
-- Card details, and anything that could be used to charge somebody. The
-- provider owns those; this holds a reference and nothing else.

create table plans (
  account_id uuid primary key references accounts (id) on delete cascade,
  -- free, pro, ultra.
  tier text not null default 'free',
  -- Metered Coach turns per period. Denormalised from the tier so a price
  -- change does not retroactively alter what somebody already paid for.
  coach_allowance integer not null default 20,
  used_this_period integer not null default 0,
  -- When the current period ends. A cancelled plan keeps its allowance until
  -- this instant and reverts afterwards, which is what the user paid for.
  period_end timestamptz,
  -- The provider's subscription id. Opaque here on purpose.
  provider_subscription_id text,
  -- active, cancelling, past_due, cancelled.
  billing_status text not null default 'active',
  updated_at timestamptz not null default now()
);
