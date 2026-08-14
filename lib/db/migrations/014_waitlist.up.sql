-- The waiting list, now that the rest of the product already lives here.
--
-- This used to be a private Vercel Blob store. That was the right shape when
-- the app ran on Vercel and had no Postgres. It is the wrong shape now: there
-- is one database, the list is a few hundred rows, and a second store is a
-- second thing to provision, authenticate and remember.
--
-- The primary key is the normalized address. Two submits of the same person
-- are one row, which is what the blob pathname-hash used to buy, without a
-- second round trip.

create table waitlist (
  email text primary key,
  source text not null,
  joined_at timestamptz not null default now()
);
