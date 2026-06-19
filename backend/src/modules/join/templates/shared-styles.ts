/** Shared inline CSS for server-rendered join pages (from prototype/guest.html). */
export const JOIN_PAGE_STYLES = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background: #F2F2F7;
    min-height: 100vh;
    color: #1a1a2e;
  }
  .page { max-width: 480px; margin: 0 auto; min-height: 100vh; display: flex; flex-direction: column; }
  .header {
    background: linear-gradient(145deg, #0B3D45, #0E5C66 55%, #1A8F9E);
    padding: 32px 24px 28px;
    color: #fff;
    text-align: center;
  }
  .logo-row { display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 14px; }
  .logo-icon {
    width: 30px; height: 30px; border-radius: 9px;
    background: rgba(255,255,255,0.18);
    display: flex; align-items: center; justify-content: center;
    font-size: 15px;
  }
  .logo-text { font-size: 15px; font-weight: 700; opacity: 0.92; }
  .invite-badge {
    display: inline-block; font-size: 11px; font-weight: 700;
    background: rgba(255,255,255,0.16); padding: 5px 12px; border-radius: 14px;
    margin-bottom: 12px; letter-spacing: 0.3px;
  }
  .event-name { font-size: 24px; font-weight: 800; margin-bottom: 6px; line-height: 1.2; }
  .host { font-size: 13px; opacity: 0.75; }
  .body { flex: 1; background: #fff; padding: 24px; }
  .title { font-size: 22px; font-weight: 800; margin-bottom: 6px; }
  .subtitle { font-size: 13px; color: #6B7280; line-height: 1.6; margin-bottom: 22px; }
  .field { margin-bottom: 16px; }
  .label { font-size: 12px; font-weight: 600; color: #6B7280; margin-bottom: 6px; display: block; }
  .input, .select {
    width: 100%; padding: 14px; border-radius: 12px; border: 1.5px solid #E5E7EB;
    font-size: 15px; color: #1a1a2e; background: #F9FAFB;
  }
  .phone-row { display: flex; gap: 8px; }
  .select { width: auto; min-width: 92px; flex-shrink: 0; }
  .phone-input { flex: 1; }
  .privacy-note {
    font-size: 12px; color: #6B7280; text-align: center; margin-top: 14px;
    line-height: 1.55; background: #F9FAFB; border: 1px solid #E5E7EB;
    border-radius: 12px; padding: 12px 14px;
  }
  .legal {
    font-size: 11px; color: #9CA3AF; text-align: center; margin-top: 14px; line-height: 1.5;
  }
  .legal a { color: #0E5C66; font-weight: 600; text-decoration: none; }
  .sms-consent {
    font-size: 11px; color: #9CA3AF; text-align: center; margin-top: 8px; line-height: 1.5;
  }
  .btn {
    width: 100%; padding: 16px; border-radius: 16px; border: none; cursor: pointer;
    background: linear-gradient(135deg, #0E5C66, #1A8F9E);
    color: #fff; font-size: 16px; font-weight: 700; margin-top: 8px;
  }
  .btn-secondary {
    background: #fff; color: #0E5C66; border: 1.5px solid #A5D8E0;
    margin-top: 12px; display: inline-block; text-align: center; text-decoration: none;
  }
  .error {
    background: #FEF2F2; border: 1px solid #FECACA; color: #B91C1C;
    padding: 12px 14px; border-radius: 12px; font-size: 13px; margin-bottom: 16px;
  }
  .info {
    background: #FFFBEB; border: 1px solid #FDE68A; color: #92400E;
    padding: 12px 14px; border-radius: 12px; font-size: 13px; margin-bottom: 16px;
  }
  .success-icon {
    width: 72px; height: 72px; border-radius: 24px;
    background: linear-gradient(135deg, #0E5C66, #1A8F9E);
    color: #fff; font-size: 32px; display: flex; align-items: center; justify-content: center;
    margin: 0 auto 20px;
  }
  .center { text-align: center; }
  .otp-input {
    width: 100%; max-width: 220px; text-align: center; letter-spacing: 0.35em;
    font-size: 24px; font-weight: 700; padding: 16px;
  }
`;

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
