drop index if exists accounts_email_lower_key;
alter table accounts drop column email;
