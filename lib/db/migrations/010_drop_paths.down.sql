-- The shape back, empty. See 009 for why the content cannot return.

update app_state
   set state = state || jsonb_build_object(
         'paths',
         jsonb_build_object('targetId', 'null'::jsonb, 'customNodes', '[]'::jsonb, 'customEdges', '[]'::jsonb)
       ),
       updated_at = now()
 where not (state ? 'paths');
