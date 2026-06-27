import { JOIN_PAGE_STYLES, escapeHtml } from './shared-styles';

export function renderOtpEntryPage(input: {
  token: string;
  eventTitle: string;
  phoneE164: string;
  displayName: string;
  csrfToken: string;
  errorMessage?: string;
  lockedMessage?: string;
}): string {
  const errorBlock = input.errorMessage
    ? `<div class="error">${escapeHtml(input.errorMessage)}</div>`
    : '';
  const lockedBlock = input.lockedMessage
    ? `<div class="info">${escapeHtml(input.lockedMessage)}</div>`
    : '';

  const lastFour = input.phoneE164.slice(-4);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Enter code — LetsSplyt</title>
  <style>${JOIN_PAGE_STYLES}</style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div class="logo-row"><div class="logo-icon">✦</div><div class="logo-text">LetsSplyt</div></div>
      <h1 class="event-name">${escapeHtml(input.eventTitle)}</h1>
    </div>
    <div class="body center">
      <h2 class="title">Enter your code</h2>
      <p class="subtitle">We sent a 6-digit code to the number ending in ${escapeHtml(lastFour)}.</p>
      ${lockedBlock}
      ${errorBlock}
      <form id="otp-verify-form" method="post" action="/join/${escapeHtml(input.token)}/otp/verify">
        <input type="hidden" name="csrf_token" value="${escapeHtml(input.csrfToken)}">
        <input type="hidden" name="phone_e164" value="${escapeHtml(input.phoneE164)}">
        <input type="hidden" name="display_name" value="${escapeHtml(input.displayName)}">
        <div class="field">
          <label class="label" for="code">Verification code</label>
          <input class="input otp-input" id="code" name="code" required maxlength="8" minlength="6"
            inputmode="numeric" pattern="[0-9]{6}" autocomplete="one-time-code" placeholder="000000">
        </div>
        <button class="btn" id="otp-verify-btn" type="submit">Verify →</button>
      </form>
      <script>
        (function () {
          var form = document.getElementById('otp-verify-form');
          var btn = document.getElementById('otp-verify-btn');
          var codeInput = document.getElementById('code');
          if (!form || !btn || !codeInput) return;
          form.addEventListener('submit', function (event) {
            codeInput.value = (codeInput.value || '').replace(/\D/g, '').slice(0, 6);
            if (codeInput.value.length !== 6) {
              event.preventDefault();
              return;
            }
            if (btn.disabled) {
              event.preventDefault();
              return;
            }
            btn.disabled = true;
            btn.textContent = 'Verifying…';
          });
        })();
      </script>
    </div>
  </div>
</body>
</html>`;
}
