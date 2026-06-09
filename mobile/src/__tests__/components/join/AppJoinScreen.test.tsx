import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AppJoinScreen } from '../../../screens/join/AppJoinScreen';
import * as joinService from '../../../services/join.service';
import { ApiRequestError } from '../../../services/api';

const mockNavigate = jest.fn();
const mockReplace = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
    replace: mockReplace,
  }),
}));

jest.mock('../../../services/join.service');

jest.mock('../../../store/authStore', () => ({
  useAuthStore: (selector: (state: { user: { display_name: string } }) => unknown) =>
    selector({ user: { display_name: 'Alex' } }),
}));

jest.mock('../../../store/joinStore', () => ({
  useJoinStore: {
    getState: () => ({
      setPendingJoinToken: jest.fn(),
      clearPendingJoinToken: jest.fn(),
    }),
  },
}));

const navigation = {
  navigate: mockNavigate,
  replace: mockReplace,
} as never;

const route = {
  key: 'AppJoin-1',
  name: 'AppJoin' as const,
  params: { token: 'join-token-abc' },
};

describe('AppJoinScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(joinService.fetchJoinPreview).mockResolvedValue({
      eventName: 'Friday Dinner',
      creatorName: 'Pawan',
      joinable: true,
      pageKind: 'form',
    });
    jest.mocked(joinService.appJoinEvent).mockResolvedValue({
      eventId: 'event-1',
      eventName: 'Friday Dinner',
      amount_owed: null,
      participantId: 'participant-1',
    });
  });

  it('renders event name from preview', async () => {
    render(<AppJoinScreen navigation={navigation} route={route} />);

    await waitFor(() => {
      expect(screen.getByText('Friday Dinner')).toBeTruthy();
    });
    expect(screen.getByText(/Hosted by Pawan/)).toBeTruthy();
  });

  it('Join button calls join service', async () => {
    render(<AppJoinScreen navigation={navigation} route={route} />);

    await waitFor(() => {
      expect(screen.getByText('Friday Dinner')).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText('Join Friday Dinner as Alex'));

    await waitFor(() => {
      expect(joinService.appJoinEvent).toHaveBeenCalledWith('join-token-abc');
    });
  });

  it('navigates to AppJoinedScreen on success', async () => {
    render(<AppJoinScreen navigation={navigation} route={route} />);

    await waitFor(() => {
      expect(screen.getByText('Friday Dinner')).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText('Join Friday Dinner as Alex'));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('AppJoined', {
        eventId: 'event-1',
        eventName: 'Friday Dinner',
      });
    });
  });

  it('navigates to AppLockedScreen when event is locked', async () => {
    jest.mocked(joinService.fetchJoinPreview).mockResolvedValueOnce({
      eventName: 'Friday Dinner',
      creatorName: 'Pawan',
      joinable: false,
      pageKind: 'locked',
    });

    render(<AppJoinScreen navigation={navigation} route={route} />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('AppLocked', {
        creatorName: 'Pawan',
        eventName: 'Friday Dinner',
      });
    });
  });

  it('navigates to AppLockedScreen when join returns GROUP_IS_LOCKED', async () => {
    jest.mocked(joinService.appJoinEvent).mockRejectedValueOnce(
      new ApiRequestError('GROUP_IS_LOCKED', 'Locked', 400),
    );

    render(<AppJoinScreen navigation={navigation} route={route} />);

    await waitFor(() => {
      expect(screen.getByText('Friday Dinner')).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText('Join Friday Dinner as Alex'));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('AppLocked', {
        creatorName: 'Pawan',
        eventName: 'Friday Dinner',
      });
    });
  });
});
