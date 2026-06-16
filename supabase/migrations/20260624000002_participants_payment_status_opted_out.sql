-- participants.payment_status must allow 'opted_out' (TCPA STOP). Some remote dev DBs were missing it.

ALTER TABLE participants
  DROP CONSTRAINT IF EXISTS participants_payment_status_check;

ALTER TABLE participants
  ADD CONSTRAINT participants_payment_status_check
  CHECK (payment_status IN (
    'pending',
    'self_reported',
    'payer_marked',
    'confirmed',
    'disputed',
    'opted_out',
    'settled'
  ));
