-- ─────────────────────────────────────────────────────────────────────────────
-- seed.sql
-- Development and staging seed data for LetsSplyt.
-- DO NOT run in production.
-- Uses Twilio magic test numbers: +15005550001, +15005550002, +15005550003
-- Phone hashes are HMAC-SHA256(phone_e164, 'dev-test-salt') — dev salt only.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Test Users ────────────────────────────────────────────────────────────────
INSERT INTO users (
  id, phone_hash, phone_encrypted, name_encrypted, display_name,
  acquisition_source, total_events_created, total_events_joined,
  created_at, updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'dev_hash_15005550001',
  'dev_encrypted_phone_1',
  'dev_encrypted_name_alex',
  'Alex R.',
  'organic',
  2, 0,
  NOW() - INTERVAL '30 days', NOW() - INTERVAL '1 day'
);

INSERT INTO users (
  id, phone_hash, phone_encrypted, name_encrypted, display_name,
  acquisition_source, total_events_created, total_events_joined,
  created_at, updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000002',
  'dev_hash_15005550002',
  'dev_encrypted_phone_2',
  'dev_encrypted_name_jordan',
  'Jordan K.',
  'qr_scan',
  0, 2,
  NOW() - INTERVAL '28 days', NOW() - INTERVAL '2 days'
);

INSERT INTO users (
  id, phone_hash, phone_encrypted, name_encrypted, display_name,
  acquisition_source, total_events_created, total_events_joined,
  created_at, updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000003',
  'dev_hash_15005550003',
  'dev_encrypted_phone_3',
  'dev_encrypted_name_sam',
  'Sam T.',
  'sms_invite',
  0, 1,
  NOW() - INTERVAL '25 days', NOW() - INTERVAL '3 days'
);

-- ── Payment Handles ────────────────────────────────────────────────────────────
INSERT INTO user_payment_handles (id, user_id, provider, handle_encrypted, display_order, is_active)
VALUES
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'venmo',   'dev_encrypted_handle_venmo_alex',   0, TRUE),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'cashapp', 'dev_encrypted_handle_cashapp_alex', 1, TRUE),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002', 'venmo',   'dev_encrypted_handle_venmo_jordan', 0, TRUE);

-- ── Event 1: Completed Event ─────────────────────────────────────────────────
INSERT INTO events (
  id, payer_id, title, event_date, total_amount, currency, status,
  split_mode, participant_count_at_lock, ai_stage,
  locked_at, messages_sent_at, fully_settled_at,
  created_at, updated_at
) VALUES (
  '20000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  'Team Dinner — Osteria Morini',
  CURRENT_DATE - INTERVAL '14 days',
  120.00, 'USD', 'settled',
  'equal', 4, 'complete',
  NOW() - INTERVAL '14 days' + INTERVAL '2 hours',
  NOW() - INTERVAL '14 days' + INTERVAL '3 hours',
  NOW() - INTERVAL '7 days',
  NOW() - INTERVAL '14 days', NOW() - INTERVAL '7 days'
);

INSERT INTO participants (
  id, event_id, user_id, display_name, join_method, amount_owed,
  payment_status, confirmed_at, self_reported_at, opted_out,
  created_at, updated_at
) VALUES
  ('30000000-0000-0000-0000-000000000001',
   '20000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000001',
   'Alex R.', 'qr_app', 30.00, 'confirmed',
   NOW() - INTERVAL '10 days', NULL, FALSE,
   NOW() - INTERVAL '14 days', NOW() - INTERVAL '10 days'),
  ('30000000-0000-0000-0000-000000000002',
   '20000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000002',
   'Jordan K.', 'qr_app', 30.00, 'confirmed',
   NOW() - INTERVAL '12 days', NOW() - INTERVAL '13 days', FALSE,
   NOW() - INTERVAL '14 days', NOW() - INTERVAL '12 days'),
  ('30000000-0000-0000-0000-000000000003',
   '20000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000003',
   'Sam T.', 'manual_phone', 30.00, 'self_reported',
   NULL, NOW() - INTERVAL '11 days', FALSE,
   NOW() - INTERVAL '14 days', NOW() - INTERVAL '11 days'),
  ('30000000-0000-0000-0000-000000000004',
   '20000000-0000-0000-0000-000000000001',
   NULL,
   'Casey M.', 'manual_name_only', 30.00, 'opted_out',
   NULL, NULL, TRUE,
   NOW() - INTERVAL '14 days', NOW() - INTERVAL '13 days');

-- ── Event 2: Active Event ──────────────────────────────────────────────────────
INSERT INTO events (
  id, payer_id, title, event_date, total_amount, currency, status,
  split_mode, ai_stage,
  created_at, updated_at
) VALUES (
  '20000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000001',
  'Birthday Brunch',
  CURRENT_DATE + INTERVAL '3 days',
  NULL, 'USD', 'open',
  NULL, 'none',
  NOW() - INTERVAL '1 hour', NOW() - INTERVAL '1 hour'
);

INSERT INTO participants (
  id, event_id, user_id, display_name, join_method, amount_owed,
  payment_status, created_at, updated_at
) VALUES
  ('30000000-0000-0000-0000-000000000005',
   '20000000-0000-0000-0000-000000000002',
   '00000000-0000-0000-0000-000000000001',
   'Alex R.', 'qr_app', NULL, 'pending',
   NOW() - INTERVAL '1 hour', NOW() - INTERVAL '1 hour'),
  ('30000000-0000-0000-0000-000000000006',
   '20000000-0000-0000-0000-000000000002',
   '00000000-0000-0000-0000-000000000002',
   'Jordan K.', 'qr_app', NULL, 'pending',
   NOW() - INTERVAL '45 minutes', NOW() - INTERVAL '45 minutes');

INSERT INTO event_join_tokens (id, event_id, token, expires_at, is_active, scan_count, created_at)
VALUES (
  '40000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000002',
  'dev-seed-token-birthday-brunch-2026',
  NOW() + INTERVAL '23 hours',
  TRUE, 2,
  NOW() - INTERVAL '1 hour'
);
