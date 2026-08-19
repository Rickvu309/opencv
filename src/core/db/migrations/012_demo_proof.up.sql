insert into users (id, email, password_hash)
values (
  'e10000000000000000000001',
  'demo-proof@openpath.invalid',
  '$2b$12$D0jUjQeovDpnZQGma.iJb.dgcbFhj7gAsejN3bHCLDypHNy98eN6e'
);

insert into proofs (id, user_id, title, role, date_from, status, page_draft)
values (
  'e10000000000000000000002',
  'e10000000000000000000001',
  'Saturday close',
  'Barista',
  '8 Aug 2026',
  'published',
  '{"what":"I closed the café on Saturday after the other closer called out.","did":"I wrote a one-page close list so the next Saturday could lock on time.","came":""}'::jsonb
);

insert into proof_entries (id, proof_id, kind, body)
values (
  'e10000000000000000000003',
  'e10000000000000000000002',
  'note',
  'I closed the café on Saturday after the other closer called out. I wrote a one-page close list so the next Saturday could lock on time.'
);

insert into proof_pages (proof_id, user_id, slug, content)
values (
  'e10000000000000000000002',
  'e10000000000000000000001',
  'demo',
  '{"title":"Saturday close","role":"Barista","dateFrom":"8 Aug 2026","what":"I closed the café on Saturday after the other closer called out.","did":"I wrote a one-page close list so the next Saturday could lock on time."}'::jsonb
);
