import { JOIN_PAGE_STYLES, escapeHtml } from './shared-styles';

export function renderJoinSuccessPage(input: {
  eventTitle: string;
  payerName: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>You're in — LetsSplyt</title>
  <style>${JOIN_PAGE_STYLES}</style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div class="logo-row"><div class="logo-icon">✦</div><div class="logo-text">LetsSplyt</div></div>
      <div class="invite-badge">Joined</div>
      <h1 class="event-name">${escapeHtml(input.eventTitle)}</h1>
      <p class="host">Hosted by ${escapeHtml(input.payerName)}</p>
    </div>
    <div class="body center">
      <div class="success-icon">✓</div>
      <h2 class="title">You're in!</h2>
      <p class="subtitle">The bill payer will message you when the split is ready. You can close this page.</p>
    </div>
  </div>
</body>
</html>`;
}
