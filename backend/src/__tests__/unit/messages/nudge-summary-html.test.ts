import { describe, expect, it } from '@jest/globals';
import { renderNudgeSummaryPage } from '../../../modules/messages/templates/nudge-summary.html';

describe('nudge-summary.html', () => {
  it('lists each event, the total, and pay buttons for the combined amount', () => {
    const html = renderNudgeSummaryPage({
      payerName: 'Alex',
      recipientName: 'Jordan',
      rows: [
        { eventTitle: 'Dinner', amountLabel: '$20.00' },
        { eventTitle: 'Lunch', amountLabel: '$25.00' },
      ],
      totalLabel: '$45.00',
      paymentLinks: [
        {
          label: 'Venmo',
          url: 'https://account.venmo.com/pay?txn=pay&recipients=alex&amount=45.00',
          appUrl: 'venmo://paycharge?txn=pay&recipients=alex&amount=45.00',
          isInstruction: false,
        },
      ],
    });

    expect(html).toContain('Dinner');
    expect(html).toContain('Lunch');
    expect(html).toContain('$45.00');
    expect(html).toContain('You owe <strong>$45.00</strong>');
    expect(html).toContain('amount=45.00');
  });
});
