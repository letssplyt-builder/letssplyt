/**
 * Dev-only helper: delete auth + public.users rows for a phone so you can re-register.
 *
 * Usage (from backend/):
 *   doppler run -- npx ts-node scripts/cleanup-auth-by-phone.ts +12025551234
 */
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { hashPhone } from '../src/infrastructure/security';
import { supabaseAdmin } from '../src/infrastructure/supabase';
import { findAuthUserIdByPhone } from '../src/modules/auth/auth.service';

async function main(): Promise<void> {
  const phoneArg = process.argv[2];
  if (!phoneArg) {
    console.error(
      'Usage: doppler run -- npx ts-node scripts/cleanup-auth-by-phone.ts <phone_e164>',
    );
    process.exit(1);
  }

  const parsed = parsePhoneNumberFromString(phoneArg);
  if (!parsed?.isValid()) {
    console.error(`Invalid phone number: ${phoneArg}`);
    process.exit(1);
  }

  const phoneE164 = parsed.format('E.164');
  const phoneHash = hashPhone(phoneE164);

  console.log(`Cleaning up records for ${phoneE164}…`);

  const { data: publicRows, error: publicLookupError } = await supabaseAdmin
    .from('users')
    .select('id, display_name')
    .eq('phone_hash', phoneHash);

  if (publicLookupError) {
    console.error('Failed to look up public.users:', publicLookupError.message);
    process.exit(1);
  }

  for (const row of publicRows ?? []) {
    const { error } = await supabaseAdmin.from('users').delete().eq('id', row.id);
    if (error) {
      console.error(`Failed to delete public.users ${row.id}:`, error.message);
      process.exit(1);
    }
    console.log(`Deleted public.users ${row.id} (${row.display_name})`);
  }

  if (!publicRows?.length) {
    console.log('No public.users row for this phone.');
  }

  const authUserId = await findAuthUserIdByPhone(phoneE164);
  if (authUserId) {
    const { error } = await supabaseAdmin.auth.admin.deleteUser(authUserId);
    if (error) {
      console.error(`Failed to delete auth.users ${authUserId}:`, error.message);
      process.exit(1);
    }
    console.log(`Deleted auth.users ${authUserId}`);
  } else {
    console.log('No auth.users row for this phone.');
  }

  console.log(`Done — ${phoneE164} is free to use again in Get Started.`);
}

void main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
