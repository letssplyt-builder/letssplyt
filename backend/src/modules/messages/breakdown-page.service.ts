import { formatCurrency } from '../../infrastructure/security';
import { supabaseAdmin } from '../../infrastructure/supabase';
import { getPaymentConfigForPhone } from '../../config/payment-methods.config';
import { getHandles } from '../profile/profile.service';
import { buildPaymentLinkTargets } from '@letssplyt/shared/paymentLinks';
import type { PaymentProvider } from '@letssplyt/shared/profile.types';
import { loadParticipantItemNames } from './messages.service';
import { resolveParticipantPhoneContext } from './participant-phone';
import { isBreakdownLinkClosed } from './breakdown-token-expiry';
import {
  renderBreakdownClosedPage,
  renderBreakdownNotFoundPage,
  renderBreakdownPage,
  type BreakdownPaymentLink,
  type BreakdownRow,
} from './templates/breakdown.html';

interface ViewerParticipant {
  id: string;
  event_id: string;
  display_name: string;
  amount_owed: number | null;
  user_id: string | null;
  guest_pii_token: string | null;
  country_code: string | null;
  join_method: string;
}

async function fetchViewerByToken(token: string): Promise<ViewerParticipant | null> {
  const { data, error } = await supabaseAdmin
    .from('participants')
    .select(
      'id, event_id, display_name, amount_owed, user_id, guest_pii_token, country_code, join_method',
    )
    .eq('breakdown_token', token)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as ViewerParticipant;
}

export async function renderSplitBreakdownHtml(token: string): Promise<{ html: string; status: number }> {
  const viewer = await fetchViewerByToken(token);
  if (!viewer) {
    return { html: renderBreakdownNotFoundPage(), status: 404 };
  }

  const { data: eventRow, error: eventError } = await supabaseAdmin
    .from('events')
    .select('id, title, payer_id, currency, locale, total_amount, deleted_at, fully_settled_at')
    .eq('id', viewer.event_id)
    .is('deleted_at', null)
    .maybeSingle();

  if (eventError || !eventRow) {
    return { html: renderBreakdownNotFoundPage(), status: 404 };
  }

  if (isBreakdownLinkClosed(eventRow.fully_settled_at as string | null)) {
    return {
      html: renderBreakdownClosedPage(eventRow.title as string),
      status: 200,
    };
  }

  const { data: payer, error: payerError } = await supabaseAdmin
    .from('users')
    .select('display_name')
    .eq('id', eventRow.payer_id as string)
    .maybeSingle();

  if (payerError || !payer) {
    return { html: renderBreakdownNotFoundPage(), status: 404 };
  }

  const { data: participantRows, error: participantsError } = await supabaseAdmin
    .from('participants')
    .select('id, display_name, amount_owed, user_id')
    .eq('event_id', viewer.event_id)
    .order('created_at', { ascending: true });

  if (participantsError || !participantRows?.length) {
    return { html: renderBreakdownNotFoundPage(), status: 404 };
  }

  const currency = (eventRow.currency as string) ?? 'USD';
  const locale = (eventRow.locale as string) ?? 'en-US';
  const itemNamesByParticipant = await loadParticipantItemNames(viewer.event_id);

  const rows: BreakdownRow[] = participantRows.map((row) => {
    const amount = row.amount_owed as number | null;
    const itemNames = itemNamesByParticipant.get(row.id as string) ?? [];
    const itemSummary = itemNames.length > 0 ? itemNames.join(', ') : null;
    const isOrganiser = (row.user_id as string | null) === eventRow.payer_id;
    return {
      displayName: row.display_name as string,
      itemSummary,
      amountLabel: amount !== null ? formatCurrency(amount, currency, locale) : '—',
      isViewer: row.id === viewer.id,
      isOrganiser,
    };
  });

  if (rows.length === 0) {
    return { html: renderBreakdownNotFoundPage(), status: 404 };
  }

  const summedShares = participantRows.reduce((sum, row) => {
    const amount = row.amount_owed as number | null;
    return amount !== null ? sum + Number(amount) : sum;
  }, 0);

  const totalAmount =
    eventRow.total_amount !== null ? Number(eventRow.total_amount) : summedShares;

  const viewerAmount =
    viewer.amount_owed !== null ? Number(viewer.amount_owed) : null;

  const paymentLinks: BreakdownPaymentLink[] = [];
  if (viewerAmount !== null && viewerAmount > 0) {
    const phoneContext = await resolveParticipantPhoneContext({
      user_id: viewer.user_id,
      guest_pii_token: viewer.guest_pii_token,
      country_code: viewer.country_code,
      join_method: viewer.join_method,
    });
    const paymentConfig = getPaymentConfigForPhone(
      phoneContext.phoneE164 ?? '+1',
      phoneContext.resolvedCountry,
    );
    const payerHandles = await getHandles(eventRow.payer_id as string);
    const providerLabels: Record<PaymentProvider, string> = {
      venmo: 'Venmo',
      paypal: 'PayPal',
      cashapp: 'Cash App',
      zelle: 'Zelle',
      wise: 'Wise',
      upi: 'UPI',
      bank_transfer: 'Bank transfer',
      other: 'Other',
    };
    for (const handle of payerHandles) {
      if (!paymentConfig.supportedMethods.includes(handle.provider)) {
        continue;
      }
      const targets = buildPaymentLinkTargets({
        provider: handle.provider,
        handleValue: handle.handle_value,
        amountMajorUnits: viewerAmount,
        eventName: eventRow.title as string,
      });
      if (!targets) {
        continue;
      }
      paymentLinks.push({
        label: providerLabels[handle.provider],
        url: targets.webUrl,
        appUrl: targets.appUrl,
        androidIntentUrl: targets.androidIntentUrl,
        isInstruction: Boolean(targets.isInstruction),
      });
    }
  }

  const html = renderBreakdownPage({
    eventTitle: eventRow.title as string,
    payerName: payer.display_name as string,
    currency,
    rows,
    totalLabel: formatCurrency(totalAmount, currency, locale),
    viewerShareLabel:
      viewerAmount !== null ? formatCurrency(viewerAmount, currency, locale) : null,
    paymentLinks,
  });

  return { html, status: 200 };
}
