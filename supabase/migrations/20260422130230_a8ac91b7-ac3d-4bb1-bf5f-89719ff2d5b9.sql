UPDATE events
SET settings = jsonb_set(
  settings,
  '{banner_url}',
  to_jsonb(
    regexp_replace(
      split_part(settings->>'banner_url', '?', 1),
      '/storage/v1/object/sign/',
      '/storage/v1/object/public/'
    )
  )
)
WHERE settings->>'banner_url' LIKE '%/storage/v1/object/sign/event-sponsors/%';

UPDATE events
SET settings = jsonb_set(
  settings,
  '{header_logo_url}',
  to_jsonb(
    regexp_replace(
      split_part(settings->>'header_logo_url', '?', 1),
      '/storage/v1/object/sign/',
      '/storage/v1/object/public/'
    )
  )
)
WHERE settings->>'header_logo_url' LIKE '%/storage/v1/object/sign/event-sponsors/%';