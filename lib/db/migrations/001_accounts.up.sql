-- Who a person is. The anchor every other table hangs from.

create table accounts (
  id uuid primary key default gen_random_uuid(),
  username text not null,
  -- bcrypt output, never the password. The column name says so, because a
  -- column called `password` invites exactly one kind of mistake.
  password_hash text not null,
  created_at timestamptz not null default now()
);

-- Uniqueness is enforced here rather than by a check-then-insert in the
-- application, which two simultaneous sign-ups would both pass.
--
-- On the folded value: "Mai" and "mai" are one person to everyone except a
-- byte comparison, and letting the second spelling be claimed by somebody else
-- hands them a way to be mistaken for the first.
create unique index accounts_username_lower_key on accounts (lower(username));
