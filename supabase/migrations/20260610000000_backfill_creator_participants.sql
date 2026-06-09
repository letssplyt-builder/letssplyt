-- Backfill organiser rows for events created before auto-insert on createEvent.
INSERT INTO participants (event_id, user_id, display_name, join_method, payment_status)
SELECT e.id, e.payer_id, u.display_name, 'qr_app', 'pending'
FROM events e
INNER JOIN users u ON u.id = e.payer_id
WHERE e.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM participants p
    WHERE p.event_id = e.id
      AND p.user_id = e.payer_id
  );
