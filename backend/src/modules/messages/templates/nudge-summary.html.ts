import { JOIN_PAGE_STYLES, escapeHtml } from '../../join/templates/shared-styles';
import {
  BREAKDOWN_PAY_OPENER_SCRIPT,
  type BreakdownPaymentLink,
} from './breakdown.html';

export interface NudgeSummaryRow {
  eventTitle: string;
  amountLabel: string;
}

export interface NudgeSummaryPageParams {
  payerName: string;
  recipientName: string;
  rows: NudgeSummaryRow[];
  totalLabel: string;
  paymentLinks: BreakdownPaymentLink[];
}

function escapeHref(url: string): string {
  return url.replace(/"/g, '&quot;');
}

function renderPaymentSection(params: NudgeSummaryPageParams): string {
  if (params.paymentLinks.length === 0) {
    return '';
  }

  const buttons = params.paymentLinks
    .map((link) => {
      if (link.isInstruction) {
        return `<p class="pay-instruction">${escapeHtml(link.url)}</p>`;
      }
      const appAttr = link.appUrl ? ` data-app-url="${escapeHref(link.appUrl)}"` : '';
      const intentAttr = link.androidIntentUrl
        ? ` data-android-intent="${escapeHref(link.androidIntentUrl)}"`
        : '';
      return `<a class="pay-btn" href="${escapeHref(link.url)}"${appAttr}${intentAttr} onclick="return letsSplytOpenPay(this, event)">${escapeHtml(link.label)}</a>`;
    })
    .join('');

  return `<div class="pay-section">
      <h2 class="pay-title">Pay what you owe</h2>
      <p class="pay-amount">You owe <strong>${escapeHtml(params.totalLabel)}</strong> to ${escapeHtml(params.payerName)}</p>
      <div class="pay-actions">${buttons}</div>
      <p class="pay-note">Tap a button to open your payment app with the total pre-filled.</p>
    </div>`;
}

export function renderNudgeSummaryPage(params: NudgeSummaryPageParams): string {
  const tableRows = params.rows
    .map(
      (row) => `<tr class="split-row">
        <td class="col-name">${escapeHtml(row.eventTitle)}</td>
        <td class="col-amount">${escapeHtml(row.amountLabel)}</td>
      </tr>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <title>Payment reminder — LetsSplyt</title>
  <style>
    ${JOIN_PAGE_STYLES}
    .split-table { width: 100%; border-collapse: collapse; font-size: 14px; margin-top: 8px; }
    .split-table th {
      text-align: left; font-size: 11px; font-weight: 700; color: #6B7280;
      padding: 8px 6px; border-bottom: 1.5px solid #E5E7EB;
      letter-spacing: 0.04em; text-transform: uppercase;
    }
    .split-table td { padding: 12px 6px; border-bottom: 1px solid #F3F4F6; vertical-align: top; }
    .col-name { font-weight: 600; }
    .col-amount { font-weight: 700; text-align: right; white-space: nowrap; }
    .total-row td {
      border-bottom: none; padding-top: 14px; font-weight: 800; font-size: 15px;
      border-top: 1.5px solid #E5E7EB;
    }
    .footnote { font-size: 11px; color: #9CA3AF; margin-top: 20px; line-height: 1.5; text-align: center; }
    .pay-section {
      margin-top: 28px; padding-top: 24px; border-top: 1.5px solid #E5E7EB;
    }
    .pay-title { font-size: 18px; font-weight: 800; margin-bottom: 6px; color: #111827; }
    .pay-amount { font-size: 14px; color: #4B5563; margin-bottom: 16px; line-height: 1.5; }
    .pay-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 12px; }
    .pay-btn {
      display: inline-block; padding: 12px 18px; border-radius: 12px;
      background: #0E5C66; color: #fff; font-weight: 700; font-size: 14px;
      text-decoration: none; text-align: center;
    }
    .pay-instruction {
      width: 100%; font-size: 14px; color: #374151; background: #F9FAFB;
      border: 1px solid #E5E7EB; border-radius: 12px; padding: 12px 14px; margin: 0;
    }
    .pay-note { font-size: 12px; color: #9CA3AF; line-height: 1.4; }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div class="logo-row"><div class="logo-icon">✦</div><div class="logo-text">LetsSplyt</div></div>
      <div class="invite-badge">Payment reminder</div>
      <h1 class="event-name">Outstanding with ${escapeHtml(params.payerName)}</h1>
      <p class="host">Hi ${escapeHtml(params.recipientName)}</p>
    </div>
    <div class="body">
      <h2 class="title">What you still owe</h2>
      <p class="subtitle">Amounts update if you pay an event before opening this link.</p>
      <table class="split-table">
        <thead>
          <tr>
            <th>Event</th>
            <th style="text-align:right">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
          <tr class="total-row">
            <td>Total</td>
            <td class="col-amount">${escapeHtml(params.totalLabel)}</td>
          </tr>
        </tbody>
      </table>
      ${renderPaymentSection(params)}
      <p class="footnote">This link is personal — only share if you are comfortable showing these amounts.</p>
    </div>
  </div>
  <script>${BREAKDOWN_PAY_OPENER_SCRIPT}</script>
</body>
</html>`;
}

export function renderNudgeSummarySettledPage(payerName: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <title>All settled — LetsSplyt</title>
  <style>${JOIN_PAGE_STYLES}</style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div class="logo-row"><div class="logo-icon">✦</div><div class="logo-text">LetsSplyt</div></div>
      <div class="invite-badge">All settled</div>
      <h1 class="event-name">${escapeHtml(payerName)}</h1>
    </div>
    <div class="body center">
      <div class="success-icon">✓</div>
      <h2 class="title">You're all settled</h2>
      <p class="subtitle">Nothing is outstanding with ${escapeHtml(payerName)} right now.</p>
    </div>
  </div>
</body>
</html>`;
}

export function renderNudgeSummaryNotFoundPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <title>Link not found — LetsSplyt</title>
  <style>${JOIN_PAGE_STYLES}</style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div class="logo-row"><div class="logo-icon">✦</div><div class="logo-text">LetsSplyt</div></div>
      <div class="invite-badge">Not found</div>
    </div>
    <div class="body center">
      <h2 class="title">This reminder link is invalid</h2>
      <p class="subtitle">Ask the person who paid to send you a new nudge.</p>
    </div>
  </div>
</body>
</html>`;
}
