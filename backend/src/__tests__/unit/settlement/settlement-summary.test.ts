import { describe, expect, it } from '@jest/globals';
import { buildEventSettlementSummary } from '../../../modules/settlement/settlement-summary';

describe('buildEventSettlementSummary', () => {
  it('excludes organiser share from collected and outstanding', () => {
    const summary = buildEventSettlementSummary(
      [
        {
          payment_status: 'pending',
          amount_owed: 40,
          is_organiser: true,
        },
        {
          payment_status: 'confirmed',
          amount_owed: 30,
          is_organiser: false,
        },
        {
          payment_status: 'confirmed',
          amount_owed: 30,
          is_organiser: false,
        },
      ],
      100,
    );

    expect(summary.total).toBe(100);
    expect(summary.collected).toBe(60);
    expect(summary.outstanding).toBe(0);
    expect(summary.confirmed_count).toBe(2);
    expect(summary.pending_count).toBe(0);
  });

  it('counts non-organiser pending amounts as outstanding', () => {
    const summary = buildEventSettlementSummary(
      [
        {
          payment_status: 'pending',
          amount_owed: 25,
          is_organiser: true,
        },
        {
          payment_status: 'pending',
          amount_owed: 35,
          is_organiser: false,
        },
        {
          payment_status: 'self_reported',
          amount_owed: 40,
          is_organiser: false,
        },
      ],
      100,
    );

    expect(summary.collected).toBe(0);
    expect(summary.outstanding).toBe(75);
    expect(summary.pending_count).toBe(1);
  });

  it('does not treat payer_marked debtor rows as outstanding', () => {
    const summary = buildEventSettlementSummary(
      [
        { payment_status: 'pending', amount_owed: 50, is_organiser: true },
        { payment_status: 'payer_marked', amount_owed: 50, is_organiser: false },
      ],
      100,
    );

    expect(summary.outstanding).toBe(0);
    expect(summary.collected).toBe(0);
  });
});
