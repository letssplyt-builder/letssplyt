import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { MessagePreviewScreen } from '../../../screens/messages/MessagePreviewScreen';
import * as messagesService from '../../../services/messages.service';

const mockGoBack = jest.fn();
const mockNavigate = jest.fn();
const mockReplace = jest.fn();

jest.mock('../../../services/messages.service');

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    goBack: mockGoBack,
    navigate: mockNavigate,
    replace: mockReplace,
  }),
}));

const PREVIEWS: messagesService.MessagePreviewItem[] = [
  {
    participant_id: 'p1',
    display_name: 'Alex',
    amount_owed: 20,
    message_text: 'Hi Alex — your share is $20.00.',
    channel: 'sms',
    payment_links: [{ provider: 'venmo', label: 'Venmo', url: 'https://venmo.com/test' }],
    breakdown_url: 'https://letssplyt.app/split/token-p1',
  },
  {
    participant_id: 'p2',
    display_name: 'Jordan',
    amount_owed: 25,
    message_text: 'Hi Jordan — your share is $25.00.',
    channel: 'sms',
    payment_links: [],
    breakdown_url: null,
  },
];

describe('MessagePreviewScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(messagesService, 'fetchMessagePreviews').mockResolvedValue({ previews: PREVIEWS });
  });

  it('renders one card per participant after load', async () => {
    render(
      <MessagePreviewScreen
        navigation={{ goBack: mockGoBack, navigate: mockNavigate } as never}
        route={{ key: 'MessagePreview-1', name: 'MessagePreview', params: { eventId: 'event-1' } }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Preview message for Alex')).toBeTruthy();
      expect(screen.getByLabelText('Preview message for Jordan')).toBeTruthy();
    });
    expect(screen.getByText(/Hi Alex/)).toBeTruthy();
  });

  it('enables Send to all without previewing every participant', async () => {
    render(
      <MessagePreviewScreen
        navigation={{ goBack: mockGoBack, navigate: mockNavigate } as never}
        route={{ key: 'MessagePreview-1', name: 'MessagePreview', params: { eventId: 'event-1' } }}
      />,
    );

    await waitFor(() =>
      expect(screen.getByLabelText('Preview message for Alex')).toBeTruthy(),
    );

    const send = screen.getByLabelText('Send to all');
    expect(send.props.accessibilityState?.disabled ?? send.props.disabled).toBeFalsy();
  });

  it('sends messages and navigates to delivery tracking', async () => {
    jest.mocked(messagesService.sendEventMessages).mockResolvedValue({
      sent_count: 2,
      skipped_count: 0,
      failed_count: 0,
      event_status: 'sent',
      results: [
        { participant_id: 'p1', status: 'sent' },
        { participant_id: 'p2', status: 'sent' },
      ],
    });

    render(
      <MessagePreviewScreen
        navigation={{ goBack: mockGoBack, navigate: mockNavigate, replace: mockReplace } as never}
        route={{ key: 'MessagePreview-1', name: 'MessagePreview', params: { eventId: 'event-1' } }}
      />,
    );

    await waitFor(() =>
      expect(screen.getByLabelText('Preview message for Alex')).toBeTruthy(),
    );
    fireEvent.press(screen.getByLabelText('Preview message for Jordan'));
    fireEvent.press(screen.getByLabelText('Send to all'));

    await waitFor(() => {
      expect(messagesService.sendEventMessages).toHaveBeenCalledWith('event-1');
      expect(mockReplace).toHaveBeenCalledWith('DeliveryTracking', {
        eventId: 'event-1',
        sendResults: [
          { participant_id: 'p1', status: 'sent' },
          { participant_id: 'p2', status: 'sent' },
        ],
      });
    });
  });

  it('navigates to split entry when Edit is pressed', async () => {
    render(
      <MessagePreviewScreen
        navigation={{ goBack: mockGoBack, navigate: mockNavigate } as never}
        route={{ key: 'MessagePreview-1', name: 'MessagePreview', params: { eventId: 'event-1' } }}
      />,
    );

    await waitFor(() => expect(screen.getByText('Edit')).toBeTruthy());
    fireEvent.press(screen.getByLabelText('Edit split'));
    expect(mockNavigate).toHaveBeenCalledWith('SplitEntry', {
      eventId: 'event-1',
      mode: 'manual',
    });
  });
});
