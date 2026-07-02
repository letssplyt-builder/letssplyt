import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { SettlementRosterRow } from '../../../components/settlement/SettlementRosterRow';

jest.mock('expo-linear-gradient', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    LinearGradient: ({ children, ...props }: { children?: React.ReactNode }) => (
      <View {...props}>{children}</View>
    ),
  };
});

jest.mock('@react-navigation/native', () => {
  const React = require('react');
  return {
    useFocusEffect: (callback: () => void | (() => void)) => {
      React.useEffect(() => callback(), [callback]);
    },
  };
});

describe('SettlementRosterRow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders a static card without swipe affordances when no actions apply', () => {
    render(
      <SettlementRosterRow
        displayName="Jordan"
        paymentStatus="pending"
        amountOwed={24}
        currency="USD"
      />,
    );

    expect(screen.getByText('Jordan')).toBeTruthy();
    expect(screen.getByText('$24.00')).toBeTruthy();
    expect(screen.getByText('Pending')).toBeTruthy();
    expect(screen.queryByText('Mark paid')).toBeNull();
    expect(screen.queryByText('Dispute')).toBeNull();
  });

  it('shows swipe hints and paid action lane for pending members', () => {
    render(
      <SettlementRosterRow
        displayName="Jordan"
        paymentStatus="pending"
        amountOwed={24}
        userId="user-2"
        onMarkCash={jest.fn()}
      />,
    );

    expect(screen.getAllByText('Mark paid').length).toBeGreaterThan(0);
    expect(screen.getByLabelText('Mark paid')).toBeTruthy();
  });

  it('shows dispute action lane for paid registered members', () => {
    render(
      <SettlementRosterRow
        displayName="Jordan"
        paymentStatus="self_reported"
        amountOwed={24}
        userId="user-2"
        selfReportedMethod="venmo"
        onDispute={jest.fn()}
      />,
    );

    expect(screen.getByText('Paid by Venmo')).toBeTruthy();
    expect(screen.getByLabelText('Dispute')).toBeTruthy();
  });

  it('calls mark paid handler from the revealed action button', () => {
    const onMarkCash = jest.fn();

    render(
      <SettlementRosterRow
        displayName="Jordan"
        paymentStatus="pending"
        amountOwed={24}
        userId="user-2"
        onMarkCash={onMarkCash}
      />,
    );

    fireEvent.press(screen.getByLabelText('Mark paid'));
    expect(onMarkCash).toHaveBeenCalledTimes(1);
  });
});
