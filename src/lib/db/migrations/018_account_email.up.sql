-- Login identity. Username stays as a derived handle so public links and
-- traces do not carry the address. Existing rows may have no email yet.

alter table accounts add column email text;

create unique index accounts_email_lower_key on accounts (lower(email))
  where email is not null;
