-- Public Proof pages and the personal link. Snapshots, not live AppState:
-- unpublishing or editing after the fact must not rewrite what a stranger
-- already opened.

create table account_sites (
  account_id uuid primary key references accounts (id) on delete cascade,
  handle text not null unique
);

create table proof_pages (
  slug text primary key,
  account_id uuid not null references accounts (id) on delete cascade,
  paper_id text not null,
  snapshot jsonb not null,
  published_at timestamptz not null default now()
);

create index proof_pages_account_id_idx on proof_pages (account_id);
