import { describe, expect, it } from '@jest/globals';
import {
  renderBreakdownClosedPage,
  renderBreakdownPage,
} from '../../../modules/messages/templates/breakdown.html';

describe('breakdown.html', () => {
  it('embeds native app URL on pay buttons and uses direct scheme navigation on iOS', () => {
    const html = renderBreakdownPage({
      eventTitle: 'Dinner',
      payerName: 'Alex',
      currency: 'USD',
      rows: [],
      totalLabel: '$42.00',
      viewerShareLabel: '$21.00',
      paymentLinks: [
        {
          label: 'Venmo',
          url: 'https://account.venmo.com/pay?txn=pay&recipients=alex&amount=21.00',
          appUrl: 'venmo://paycharge?txn=pay&recipients=alex&amount=21.00',
          androidIntentUrl:
            'intent://paycharge?txn=pay#Intent;scheme=venmo;package=com.venmo;end',
          isInstruction: false,
        },
      ],
    });

    expect(html).toContain('data-app-url="venmo://paycharge');
    expect(html).toContain('window.location.href = app');
    expect(html).not.toContain('iframe.src = app');
  });

  it('renders split closed page with event title', () => {
    const html = renderBreakdownClosedPage('Team Dinner');
    expect(html).toContain('Split closed');
    expect(html).toContain('This split has closed');
    expect(html).toContain('Team Dinner');
  });
});
