import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, render, screen } from '@testing-library/react-native';
import { NotificationBellButton } from '../../../components/notifications/NotificationBellButton';
import { useNotificationStore } from '../../../store/notificationStore';

describe('NotificationBellButton', () => {
  beforeEach(() => {
    useNotificationStore.getState().clear();
  });

  it('shows badge when unreadCount > 0', () => {
    useNotificationStore.setState({ unreadCount: 3 });

    render(<NotificationBellButton onPress={jest.fn()} />);

    expect(screen.getByLabelText('Notifications, 3 unread')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
  });

  it('hides badge when unreadCount is 0', () => {
    useNotificationStore.setState({ unreadCount: 0 });

    render(<NotificationBellButton onPress={jest.fn()} />);

    expect(screen.getByLabelText('Notifications')).toBeTruthy();
    expect(screen.queryByText('0')).toBeNull();
  });

  it('updates badge immediately when store unreadCount changes', async () => {
    useNotificationStore.setState({ unreadCount: 2 });
    render(<NotificationBellButton onPress={jest.fn()} />);
    expect(screen.getByText('2')).toBeTruthy();

    await act(async () => {
      useNotificationStore.setState({ unreadCount: 1 });
    });

    expect(screen.getByLabelText('Notifications, 1 unread')).toBeTruthy();
  });
});
