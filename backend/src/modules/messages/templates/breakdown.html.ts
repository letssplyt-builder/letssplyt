import { JOIN_PAGE_STYLES, escapeHtml } from '../../join/templates/shared-styles';

export interface BreakdownRow {
  displayName: string;
  itemSummary: string | null;
  amountLabel: string;
  isViewer: boolean;
  isOrganiser: boolean;
}

function formatParticipantLabel(row: BreakdownRow): string {
  const tags: string[] = [];
  if (row.isViewer) tags.push('you');
  if (row.isOrganiser) tags.push('organiser');
  const suffix = tags.length > 0 ? ` (${tags.join(', ')})` : '';
  return `${escapeHtml(row.displayName)}${suffix}`;
}

export interface BreakdownPageParams {
  eventTitle: string;
  payerName: string;
  currency: string;
  rows: BreakdownRow[];
  totalLabel: string;
}

export function renderBreakdownPage(params: BreakdownPageParams): string {
  const title = escapeHtml(params.eventTitle);
  const payer = escapeHtml(params.payerName);
  const showItems = params.rows.some((row) => row.itemSummary);

  const tableRows = params.rows
    .map((row) => {
      const nameCell = row.isViewer
        ? `<strong>${formatParticipantLabel(row)}</strong>`
        : formatParticipantLabel(row);
      const itemsCell = row.itemSummary ? escapeHtml(row.itemSummary) : '—';
      const rowClass = row.isViewer ? 'split-row split-row-you' : 'split-row';
      return `<tr class="${rowClass}">
        <td class="col-name">${nameCell}</td>
        ${showItems ? `<td class="col-items">${itemsCell}</td>` : ''}
        <td class="col-amount">${escapeHtml(row.amountLabel)}</td>
      </tr>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <title>Split breakdown — LetsSplyt</title>
  <style>
    ${JOIN_PAGE_STYLES}
    .split-table { width: 100%; border-collapse: collapse; font-size: 14px; margin-top: 8px; }
    .split-table th {
      text-align: left; font-size: 11px; font-weight: 700; color: #6B7280;
      padding: 8px 6px; border-bottom: 1.5px solid #E5E7EB;
      letter-spacing: 0.04em; text-transform: uppercase;
    }
    .split-table td { padding: 12px 6px; border-bottom: 1px solid #F3F4F6; vertical-align: top; }
    .col-name { font-weight: 600; width: 34%; }
    .col-items { color: #6B7280; font-size: 13px; width: 40%; }
    .col-amount { font-weight: 700; text-align: right; white-space: nowrap; }
    .split-row-you { background: #EEF2FF; }
    .split-row-you td { border-bottom-color: #C7D2FE; }
    .total-row td {
      border-bottom: none; padding-top: 14px; font-weight: 800; font-size: 15px;
      border-top: 1.5px solid #E5E7EB;
    }
    .footnote { font-size: 11px; color: #9CA3AF; margin-top: 20px; line-height: 1.5; text-align: center; }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div class="logo-row"><div class="logo-icon">✦</div><div class="logo-text">LetsSplyt</div></div>
      <div class="invite-badge">Split breakdown</div>
      <h1 class="event-name">${title}</h1>
      <p class="host">${payer} paid the bill</p>
    </div>
    <div class="body">
      <h2 class="title">Who owes what</h2>
      <p class="subtitle">Your row is highlighted. Amounts include tax and tip where applicable.</p>
      <table class="split-table">
        <thead>
          <tr>
            <th>Name</th>
            ${showItems ? '<th>Items</th>' : ''}
            <th style="text-align:right">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
          <tr class="total-row">
            <td${showItems ? '' : ''}>Total</td>
            ${showItems ? '<td></td>' : ''}
            <td class="col-amount">${escapeHtml(params.totalLabel)}</td>
          </tr>
        </tbody>
      </table>
      <p class="footnote">This link is personal — only share if you are comfortable showing the full split.</p>
    </div>
  </div>
</body>
</html>`;
}

export function renderBreakdownNotFoundPage(): string {
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
      <h2 class="title">This split link is invalid or has expired</h2>
      <p class="subtitle">Ask the person who paid the bill to send you a new message.</p>
    </div>
  </div>
</body>
</html>`;
}
