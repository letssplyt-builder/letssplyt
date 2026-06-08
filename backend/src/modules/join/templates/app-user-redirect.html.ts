import { JOIN_PAGE_STYLES, escapeHtml } from './shared-styles';

export function renderAppUserRedirectPage(input: {
  eventTitle: string;
  deepLinkUrl: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Open LetsSplyt app</title>
  <style>${JOIN_PAGE_STYLES}</style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div class="logo-row"><div class="logo-icon">✦</div><div class="logo-text">LetsSplyt</div></div>
      <h1 class="event-name">${escapeHtml(input.eventTitle)}</h1>
    </div>
    <div class="body center">
      <h2 class="title">You already have LetsSplyt!</h2>
      <p class="subtitle">Open the app to join this event with your account.</p>
      <a class="btn btn-secondary" href="${escapeHtml(input.deepLinkUrl)}">Open LetsSplyt app →</a>
    </div>
  </div>
</body>
</html>`;
}
