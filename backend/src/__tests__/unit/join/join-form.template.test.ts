import { describe, expect, it } from '@jest/globals';
import { renderJoinFormPage } from '../../../modules/join/templates/join-form.html';

describe('renderJoinFormPage', () => {
  it('shows privacy assurance and legal links below Join', () => {
    const html = renderJoinFormPage({
      token: 'join-token',
      eventTitle: 'Friday Dinner',
      payerName: 'Alex',
      csrfToken: 'csrf-test',
      appBaseUrl: 'https://letssplyt.app',
    });

    expect(html).toContain('never shared with the organiser');
    expect(html).toContain('href="https://letssplyt.app/terms.html"');
    expect(html).toContain('href="https://letssplyt.app/privacy.html"');
    expect(html).toContain('Msg &amp; data rates may apply');
    expect(html).toContain('Reply STOP to opt out');
    expect(html).toContain('HELP for help');
    expect(html.indexOf('Join →')).toBeLessThan(html.indexOf('Msg &amp; data rates may apply'));
    expect(html).not.toContain('By entering your phone number, you agree to receive');
  });
});
