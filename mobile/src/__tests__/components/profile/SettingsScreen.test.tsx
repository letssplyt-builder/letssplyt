import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { SettingsScreen } from '../../../screens/profile/SettingsScreen';
import { useProfileStore } from '../../../store/profileStore';

const mockNavigate = jest.fn();
const mockNavigation = { navigate: mockNavigate };

describe('SettingsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useProfileStore.setState({
      user: {
        id: 'user-settings',
        display_name: 'Settings User',
        avatar_colour: '#6366F1',
        avatar_url: null,
        total_events_created: 0,
        total_events_joined: 0,
        created_at: '2026-01-01T00:00:00.000Z',
        push_notifications_enabled: true,
        payment_alert_notifications_enabled: true,
        share_alert_notifications_enabled: true,
      },
      handles: [],
      loadProfile: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
      updateNotificationPreferences: jest
        .fn<() => Promise<void>>()
        .mockResolvedValue(undefined),
    } as never);
  });

  it('renders main sections and actions', () => {
    render(<SettingsScreen navigation={mockNavigation as never} route={{} as never} />);

    expect(screen.getByText('Settings')).toBeTruthy();
    expect(screen.getByText('Account')).toBeTruthy();
    expect(screen.getByText('Legal')).toBeTruthy();
    expect(screen.getByText('Notifications')).toBeTruthy();
    expect(screen.getByText('Security')).toBeTruthy();
    expect(screen.getByText('Log out')).toBeTruthy();
    expect(screen.getByText('Delete account')).toBeTruthy();
  });

  it('navigates to legal documents from Legal section', () => {
    render(<SettingsScreen navigation={mockNavigation as never} route={{} as never} />);

    fireEvent.press(screen.getByText('Terms & Conditions'));
    expect(mockNavigate).toHaveBeenCalledWith('LegalDocument', { document: 'terms' });

    fireEvent.press(screen.getByText('Privacy Policy'));
    expect(mockNavigate).toHaveBeenCalledWith('LegalDocument', { document: 'privacy' });
  });
});
