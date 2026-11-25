DELETE FROM "opencv_app"."paper_docs" WHERE "crdt_document" IS NULL OR NOT ("crdt_document" ->> 'version' = '4' AND "crdt_document" ->> 'schemaRevision' = '2');
