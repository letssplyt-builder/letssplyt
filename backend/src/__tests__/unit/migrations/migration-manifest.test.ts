import { describe, expect, it } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Ensures every SQL file in supabase/migrations/ is listed here and in supabase/MIGRATIONS.md.
 * When adding a migration, update this array and MIGRATIONS.md before merging.
 */
const EXPECTED_MIGRATIONS = [
  '20260601000000_initial_schema.sql',
  '20260608000000_users_auth_registration.sql',
  '20260608164200_device_sessions_expo_push_token.sql',
  '20260608164500_device_sessions_rls_fix.sql',
  '20260608164600_device_sessions_app_version_nullable.sql',
  '20260608200000_events_ai_stage_locale.sql',
  '20260608210000_guest_pii_and_participants_token.sql',
  '20260609000000_ensure_funnel_checkpoints.sql',
  '20260609000001_ensure_participants_web_join.sql',
  '20260610000000_backfill_creator_participants.sql',
  '20260610000001_receipts_storage_bucket.sql',
  '20260611000000_receipt_items_ai_columns.sql',
  '20260611100000_receipt_items_full_schema_repair.sql',
  '20260612000000_event_fees_and_receipt_item_is_fee.sql',
  '20260613000000_events_last_parse_attempt_id.sql',
  '20260614000000_events_ai_stage_parsed_confirmed.sql',
  '20260615000000_reset_event_expenses_function.sql',
  '20260616000000_participants_breakdown_token.sql',
  '20260617000000_settlement_log_audit_columns.sql',
  '20260617000001_settlement_log_action_disputed.sql',
  '20260618000000_event_delete_fk_cascade.sql',
  '20260619000000_device_sessions_trust_columns.sql',
] as const;

const REPO_ROOT = path.resolve(__dirname, '../../../../..');
const MIGRATIONS_DIR = path.join(REPO_ROOT, 'supabase', 'migrations');

describe('supabase migration manifest', () => {
  it('matches every file in supabase/migrations/', () => {
    const onDisk = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((name) => name.endsWith('.sql'))
      .sort();

    expect(onDisk).toEqual([...EXPECTED_MIGRATIONS]);
  });

  it('uses strictly increasing timestamps', () => {
    const versions = EXPECTED_MIGRATIONS.map((file) => file.split('_')[0]);
    for (let i = 1; i < versions.length; i++) {
      expect(versions[i] > versions[i - 1]).toBe(true);
    }
  });
});
