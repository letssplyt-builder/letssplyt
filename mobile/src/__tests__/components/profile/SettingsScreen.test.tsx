import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { SettingsScreen } from '../../../screens/profile/SettingsScreen';
import { AppearanceScreen } from '../../../screens/profile/AppearanceScreen';
import { useProfileStore } from '../../../store/profileStore';
import { renderWithTheme } from '../../helpers/renderWithTheme';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockNavigation = { navigate: mockNavigate, goBack: mockGoBack };

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
    renderWithTheme(<SettingsScreen navigation={mockNavigation as never} route={{} as never} />);

    expect(screen.getByText('Settings')).toBeTruthy();
    expect(screen.getByText('Account')).toBeTruthy();
    expect(screen.getByText('Appearance')).toBeTruthy();
    expect(screen.getByText('Legal')).toBeTruthy();
    expect(screen.getByText('Notifications')).toBeTruthy();
    expect(screen.getByText('Security')).toBeTruthy();
    expect(screen.getByText('Log out')).toBeTruthy();
    expect(screen.getByText('Delete account')).toBeTruthy();
  });

  it('navigates to Appearance from the row below Account', () => {
    renderWithTheme(<SettingsScreen navigation={mockNavigation as never} route={{} as never} />);

    fireEvent.press(screen.getByText('Appearance'));
    expect(mockNavigate).toHaveBeenCalledWith('Appearance');
  });

  it('navigates to legal documents from Legal section', () => {
    renderWithTheme(<SettingsScreen navigation={mockNavigation as never} route={{} as never} />);

    fireEvent.press(screen.getByText('Terms & Conditions'));
    expect(mockNavigate).toHaveBeenCalledWith('LegalDocument', { document: 'terms' });

    fireEvent.press(screen.getByText('Privacy Policy'));
    expect(mockNavigate).toHaveBeenCalledWith('LegalDocument', { document: 'privacy' });
  });
});

describe('AppearanceScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders theme options and goes back', () => {
    renderWithTheme(<AppearanceScreen navigation={mockNavigation as never} route={{} as never} />);

    expect(screen.getByText('Appearance')).toBeTruthy();
    expect(screen.getByText('Choose how LetsSplyt looks on your device.')).toBeTruthy();
    expect(screen.getByText('Aurora')).toBeTruthy();
    expect(screen.getByText('Solid')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Go back'));
    expect(mockGoBack).toHaveBeenCalled();
  });
});
