import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import { BalanceHeroCard } from '../../../components/events/BalanceHeroCard';

describe('BalanceHeroCard', () => {
  it('shows owed_to_you and you_owe from balance API (members + guests combined)', () => {
    render(
      <BalanceHeroCard
        balance={{
          net_balance: 45,
          currency: 'USD',
          owed_to_you: 60,
          you_owe: 15,
        }}
        isLoading={false}
        error={false}
        onRetry={() => {}}
      />,
    );

    expect(screen.getByText('$60.00')).toBeTruthy();
    expect(screen.getByText('$15.00')).toBeTruthy();
    expect(screen.getByText('$45.00')).toBeTruthy();
  });

  it('shows unavailable placeholders when balance is not ready', () => {
    render(
      <BalanceHeroCard
        balance={{
          net_balance: 0,
          currency: 'USD',
          owed_to_you: 0,
          you_owe: 0,
          unavailable: true,
        }}
        isLoading={false}
        error={false}
        onRetry={() => {}}
      />,
    );

    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Settles after bills are split')).toBeTruthy();
  });
});
