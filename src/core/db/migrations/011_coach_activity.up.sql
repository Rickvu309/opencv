alter table conversations
  add column last_message_at timestamptz not null default now();

update conversations c
set last_message_at = coalesce(
  (select max(m.created_at) from messages m where m.conversation_id = c.id),
  c.updated_at,
  c.created_at
);
