import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { render, waitFor } from '@testing-library/react-native';
import { DeletedScreen } from '../../../screens/profile/DeletedScreen';
import { useAuthStore } from '../../../store/authStore';

const mockClearSession = jest.fn<() => Promise<void>>().mockResolvedValue();

describe('DeletedScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({
      clearSession: mockClearSession,
    } as never);
  });

  it('navigates to WelcomeScreen after 3 seconds', async () => {
    jest.useFakeTimers();

    render(<DeletedScreen navigation={{} as never} route={{} as never} />);

    jest.advanceTimersByTime(3000);

    await waitFor(() => {
      expect(mockClearSession).toHaveBeenCalledTimes(1);
    });

    jest.useRealTimers();
  });
});
