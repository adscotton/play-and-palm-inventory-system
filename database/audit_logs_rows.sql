INSERT INTO "public"."audit_logs" (
  "id",
  "user_id",
  "entity_type",
  "entity_id",
  "action",
  "details",
  "created_at"
) VALUES
  ('1', '1', 'product', '1', 'CREATE', '{"name":"PlayStation 5 Disc","stock":8}', now()),
  ('2', '1', 'product', '1', 'UPDATE_PRICE', '{"price":499.00}', now()),
  ('3', '2', 'product', '2', 'UPDATE_STOCK', '{"stock":5,"status":"Low in Stock","username":"staff"}', now());
