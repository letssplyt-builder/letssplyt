import type { BreakdownPaymentLink } from './templates/breakdown.html';
import { formatCurrency } from '../../infrastructure/security';
import { supabaseAdmin } from '../../infrastructure/supabase';
import { getPaymentConfigForPhone } from '../../config/payment-methods.config';
import { getHandles } from '../profile/profile.service';
import { buildPaymentLinkTargets } from '@letssplyt/shared/paymentLinks';
import type { PaymentProvider } from '@letssplyt/shared/profile.types';
import { isOutstandingPaymentStatus } from '../settlement/outstanding';
import { resolveParticipantPhoneContext } from './participant-phone';
import {
  renderNudgeSummaryNotFoundPage,
  renderNudgeSummaryPage,
  renderNudgeSummarySettledPage,
  type NudgeSummaryRow,
} from './templates/nudge-summary.html';

interface NudgeLinkRow {
  token: string;
  payer_id: string;
  counterparty_user_id: string | null;
  guest_phone_hash: string | null;
}

interface OutstandingShare {
  eventId: string;
  eventTitle: string;
  amount: number;
  currency: string;
  locale: string;
  participantId: string;
  userId: string | null;
  guestPiiToken: string | null;
  countryCode: string | null;
  joinMethod: string;
  displayName: string;
}

const PROVIDER_LABELS: Record<PaymentProvider, string> = {
  venmo: 'Venmo',
  paypal: 'PayPal',
  cashapp: 'Cash App',
  zelle: 'Zelle',
  wise: 'Wise',
  upi: 'UPI',
  bank_transfer: 'Bank transfer',
  other: 'Other',
};

export async function renderNudgeSummaryHtml(
  token: string,
): Promise<{ html: string; status: number }> {
  const link = await fetchNudgeLink(token);
  if (!link) {
    return { html: renderNudgeSummaryNotFoundPage(), status: 404 };
  }

  const { data: payer, error: payerError } = await supabaseAdmin
    .from('users')
    .select('display_name')
    .eq('id', link.payer_id)
    .maybeSingle();

  if (payerError || !payer) {
    return { html: renderNudgeSummaryNotFoundPage(), status: 404 };
  }

  const payerName = payer.display_name as string;
  const shares = link.counterparty_user_id
    ? await loadMemberOutstanding(link.payer_id, link.counterparty_user_id)
    : await loadGuestOutstanding(link.payer_id, link.guest_phone_hash ?? '');

  if (shares.length === 0) {
    return { html: renderNudgeSummarySettledPage(payerName), status: 200 };
  }

  const currencies = new Set(shares.map((share) => share.currency));
  const currency = currencies.size === 1 ? shares[0]!.currency : 'USD';
  const locale = shares[0]!.locale;
  const total = shares.reduce((sum, share) => sum + share.amount, 0);
  const recipientName = shares[0]!.displayName;

  const rows: NudgeSummaryRow[] = shares.map((share) => ({
    eventTitle: share.eventTitle,
    amountLabel: formatCurrency(share.amount, share.currency, share.locale),
  }));

  const paymentLinks =
    currencies.size === 1 && total > 0
      ? await buildPaymentLinks(shares[0]!, link.payer_id, total, payerName)
      : [];

  return {
    html: renderNudgeSummaryPage({
      payerName,
      recipientName,
      rows,
      totalLabel: formatCurrency(total, currency, locale),
      paymentLinks,
    }),
    status: 200,
  };
}

async function fetchNudgeLink(token: string): Promise<NudgeLinkRow | null> {
  const { data, error } = await supabaseAdmin
    .from('nudge_links')
    .select('token, payer_id, counterparty_user_id, guest_phone_hash')
    .eq('token', token)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return {
    token: data.token as string,
    payer_id: data.payer_id as string,
    counterparty_user_id: data.counterparty_user_id as string | null,
    guest_phone_hash: data.guest_phone_hash as string | null,
  };
}

async function loadPayerEvents(payerId: string): Promise<
  Map<string, { title: string; currency: string; locale: string }>
> {
  const { data, error } = await supabaseAdmin
    .from('events')
    .select('id, title, currency, locale')
    .eq('payer_id', payerId)
    .is('deleted_at', null);

  if (error || !data) {
    return new Map();
  }

  return new Map(
    data.map((row) => [
      row.id as string,
      {
        title: row.title as string,
        currency: (row.currency as string | null) ?? 'USD',
        locale: (row.locale as string | null) ?? 'en-US',
      },
    ]),
  );
}

async function loadMemberOutstanding(
  payerId: string,
  counterpartyUserId: string,
): Promise<OutstandingShare[]> {
  const eventMeta = await loadPayerEvents(payerId);
  const eventIds = [...eventMeta.keys()];
  if (eventIds.length === 0) return [];

  const { data, error } = await supabaseAdmin
    .from('participants')
    .select(
      'id, event_id, display_name, amount_owed, payment_status, user_id, guest_pii_token, country_code, join_method',
    )
    .in('event_id', eventIds)
    .eq('user_id', counterpartyUserId);

  if (error) {
    return [];
  }

  return mapOutstandingShares(data ?? [], eventMeta);
}

async function loadGuestOutstanding(
  payerId: string,
  phoneHash: string,
): Promise<OutstandingShare[]> {
  if (!phoneHash) return [];
  const eventMeta = await loadPayerEvents(payerId);
  const eventIds = [...eventMeta.keys()];
  if (eventIds.length === 0) return [];

  const { data: guestParticipants, error } = await supabaseAdmin
    .from('participants')
    .select(
      'id, event_id, display_name, amount_owed, payment_status, user_id, guest_pii_token, country_code, join_method',
    )
    .in('event_id', eventIds)
    .is('user_id', null)
    .not('guest_pii_token', 'is', null)
    .neq('join_method', 'manual_name_only');

  if (error || !guestParticipants?.length) {
    return [];
  }

  const tokens = [...new Set(guestParticipants.map((row) => row.guest_pii_token as string))];
  const { data: piiRows, error: piiError } = await supabaseAdmin
    .from('guest_pii')
    .select('id, phone_hash')
    .in('id', tokens);

  if (piiError) {
    return [];
  }

  const matchingIds = new Set(
    (piiRows ?? [])
      .filter((row) => (row.phone_hash as string) === phoneHash)
      .map((row) => row.id as string),
  );

  const matched = guestParticipants.filter((row) =>
    matchingIds.has(row.guest_pii_token as string),
  );
  return mapOutstandingShares(matched, eventMeta);
}

function mapOutstandingShares(
  rows: Array<Record<string, unknown>>,
  eventMeta: Map<string, { title: string; currency: string; locale: string }>,
): OutstandingShare[] {
  const shares: OutstandingShare[] = [];
  for (const row of rows) {
    const meta = eventMeta.get(row.event_id as string);
    const amount = row.amount_owed as number | null;
    const status = row.payment_status as string;
    if (!meta) continue;
    if (!isOutstandingPaymentStatus(status) || amount === null || amount <= 0) continue;
    if ((row.join_method as string) === 'manual_name_only') continue;
    shares.push({
      eventId: row.event_id as string,
      eventTitle: meta.title,
      amount,
      currency: meta.currency,
      locale: meta.locale,
      participantId: row.id as string,
      userId: (row.user_id as string | null) ?? null,
      guestPiiToken: (row.guest_pii_token as string | null) ?? null,
      countryCode: (row.country_code as string | null) ?? null,
      joinMethod: row.join_method as string,
      displayName: row.display_name as string,
    });
  }
  shares.sort((a, b) => b.amount - a.amount);
  return shares;
}

async function buildPaymentLinks(
  sample: OutstandingShare,
  payerId: string,
  totalAmount: number,
  payerName: string,
): Promise<BreakdownPaymentLink[]> {
  const phoneContext = await resolveParticipantPhoneContext({
    user_id: sample.userId,
    guest_pii_token: sample.guestPiiToken,
    country_code: sample.countryCode,
    join_method: sample.joinMethod,
  });
  const paymentConfig = getPaymentConfigForPhone(
    phoneContext.phoneE164 ?? '+1',
    phoneContext.resolvedCountry,
  );
  const payerHandles = await getHandles(payerId);
  const paymentLinks: BreakdownPaymentLink[] = [];
  const eventName = 'LetsSplyt';

  for (const handle of payerHandles) {
    if (!paymentConfig.supportedMethods.includes(handle.provider)) {
      continue;
    }
    const targets = buildPaymentLinkTargets({
      provider: handle.provider,
      handleValue: handle.handle_value,
      amountMajorUnits: totalAmount,
      eventName: `${payerName} — ${eventName}`,
    });
    if (!targets) continue;
    paymentLinks.push({
      label: PROVIDER_LABELS[handle.provider],
      url: targets.webUrl,
      appUrl: targets.appUrl,
      androidIntentUrl: targets.androidIntentUrl,
      isInstruction: Boolean(targets.isInstruction),
    });
  }

  return paymentLinks;
}
