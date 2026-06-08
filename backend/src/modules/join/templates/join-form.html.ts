import { JOIN_COUNTRY_OPTIONS } from '../join-countries';
import { JOIN_PAGE_STYLES, escapeHtml } from './shared-styles';

export function renderJoinFormPage(input: {
  token: string;
  eventTitle: string;
  payerName: string;
  csrfToken: string;
  errorMessage?: string;
  displayName?: string;
  countryDial?: string;
  phoneNational?: string;
}): string {
  const countryOptions = JOIN_COUNTRY_OPTIONS.map((country) => {
    const selected = input.countryDial === country.dial ? ' selected' : '';
    return `<option value="${escapeHtml(country.dial)}"${selected}>${escapeHtml(country.label)}</option>`;
  }).join('');

  const errorBlock = input.errorMessage
    ? `<div class="error">${escapeHtml(input.errorMessage)}</div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Join ${escapeHtml(input.eventTitle)} — LetsSplyt</title>
  <style>${JOIN_PAGE_STYLES}</style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div class="logo-row"><div class="logo-icon">✦</div><div class="logo-text">LetsSplyt</div></div>
      <div class="invite-badge">You're invited</div>
      <h1 class="event-name">${escapeHtml(input.eventTitle)}</h1>
      <p class="host">${escapeHtml(input.payerName)} invited you to split the bill</p>
    </div>
    <div class="body">
      <h2 class="title">Join the group</h2>
      <p class="subtitle">Enter your name and phone number. No app download required.</p>
      ${errorBlock}
      <form method="post" action="/join/${escapeHtml(input.token)}/otp/request">
        <input type="hidden" name="csrf_token" value="${escapeHtml(input.csrfToken)}">
        <div class="field">
          <label class="label" for="display_name">Your name</label>
          <input class="input" id="display_name" name="display_name" required maxlength="50"
            value="${escapeHtml(input.displayName ?? '')}" autocomplete="name">
        </div>
        <div class="field">
          <label class="label" for="phone_national">Phone number</label>
          <div class="phone-row">
            <select class="select" id="country_dial" name="country_dial" aria-label="Country code">
              ${countryOptions}
            </select>
            <input class="input phone-input" id="phone_national" name="phone_national" required
              inputmode="tel" autocomplete="tel-national"
              value="${escapeHtml(input.phoneNational ?? '')}" placeholder="(555) 000-0000">
          </div>
        </div>
        <p class="privacy">
          By entering your phone number, you agree to receive a one-time verification code from LetsSplyt.
          By joining this event, you agree to receive a one-time payment request via SMS from LetsSplyt.
          Reply STOP to opt out.
        </p>
        <button class="btn" type="submit">Join →</button>
      </form>
    </div>
  </div>
</body>
</html>`;
}
