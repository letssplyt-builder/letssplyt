import { JOIN_PAGE_STYLES, escapeHtml } from './shared-styles';

export function renderExpiredPage(eventTitle?: string): string {
  const title = eventTitle ? escapeHtml(eventTitle) : 'This event';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>QR expired — LetsSplyt</title>
  <style>${JOIN_PAGE_STYLES}</style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div class="logo-row"><div class="logo-icon">✦</div><div class="logo-text">LetsSplyt</div></div>
      <div class="invite-badge">Join link expired</div>
      <h1 class="event-name">${title}</h1>
    </div>
    <div class="body center">
      <div class="success-icon">⏱</div>
      <h2 class="title">This QR code has expired</h2>
      <p class="subtitle">Ask the bill payer to regenerate the code from their LetsSplyt app.</p>
    </div>
  </div>
</body>
</html>`;
}
