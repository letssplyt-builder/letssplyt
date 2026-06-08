import { JOIN_PAGE_STYLES, escapeHtml } from './shared-styles';

export function renderLockedPage(eventTitle?: string): string {
  const title = eventTitle ? escapeHtml(eventTitle) : 'This event';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Group locked — LetsSplyt</title>
  <style>${JOIN_PAGE_STYLES}</style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div class="logo-row"><div class="logo-icon">✦</div><div class="logo-text">LetsSplyt</div></div>
      <div class="invite-badge">Group locked</div>
      <h1 class="event-name">${title}</h1>
    </div>
    <div class="body center">
      <div class="success-icon">🔒</div>
      <h2 class="title">This group is no longer accepting new members</h2>
      <p class="subtitle">The bill payer has locked the group. Contact them directly if you still need to join.</p>
    </div>
  </div>
</body>
</html>`;
}
