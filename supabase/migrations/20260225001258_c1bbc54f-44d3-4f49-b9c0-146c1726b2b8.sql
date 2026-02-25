-- Backfill existing announcements with confirmed attendee count
UPDATE announcements SET reach_count = (
  SELECT COUNT(*) FROM attendees 
  WHERE event_id = announcements.event_id
  AND registration_status = 'confirmed'
  AND deleted_at IS NULL
) WHERE reach_count = 0;