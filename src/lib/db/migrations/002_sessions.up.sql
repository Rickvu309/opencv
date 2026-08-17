-- A signed-in session. One row per open door.
--
-- The row is what makes sign-out mean something. A cookie that carried the
-- account id and nothing else could not be revoked: the server would have no
-- record to delete, and a copied cookie would keep working until it expired.

create table sessions (
  -- Not the token itself: the SHA-256 of it, in hex. The browser holds the
  -- token, this holds only what the token hashes to, so a dump of this table
  -- yields no usable session. It is the same reason `accounts` stores a hash.
  id text primary key,
  account_id uuid not null references accounts (id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

-- For signing every device out of one account, and for deleting an account.
create index sessions_account_id_idx on sessions (account_id);
-- For sweeping expired rows, which nothing does yet and something will.
create index sessions_expires_at_idx on sessions (expires_at);
