import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { HomeScreen } from './HomeScreen';
import { useAuthStore } from '../../store/authStore';

describe('HomeScreen', () => {
  beforeEach(() => {
    useAuthStore.setState({
      session: {
        access_token: 'token',
        refresh_token: 'refresh',
        expires_in: 3600,
        token_type: 'bearer',
        user: {
          id: 'user-1',
          app_metadata: {},
          user_metadata: { display_name: 'Alex' },
          aud: 'authenticated',
          created_at: '2026-01-01T00:00:00Z',
        },
      } as never,
      user: { id: 'user-1', display_name: 'Alex', avatar_colour: '#4F46E5' },
      isLoading: false,
    });
    jest.clearAllMocks();
  });

  it('shows welcome message with display name', () => {
    render(<HomeScreen />);
    expect(screen.getByText('Welcome, Alex')).toBeTruthy();
  });

  it('logs out when Log out is pressed', async () => {
    const logoutSpy = jest.spyOn(useAuthStore.getState(), 'logout').mockResolvedValue();

    render(<HomeScreen />);
    fireEvent.press(screen.getByLabelText('Log out'));

    await waitFor(() => {
      expect(logoutSpy).toHaveBeenCalled();
    });

    logoutSpy.mockRestore();
  });
});
