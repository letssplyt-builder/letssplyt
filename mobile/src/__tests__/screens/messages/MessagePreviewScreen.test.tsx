import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { MessagePreviewScreen } from '../../../screens/messages/MessagePreviewScreen';
import * as messagesService from '../../../services/messages.service';

const mockGoBack = jest.fn();
const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: mockGoBack, navigate: mockNavigate }),
}));

const PREVIEWS: messagesService.MessagePreviewItem[] = [
  {
    participant_id: 'p1',
    display_name: 'Alex',
    amount_owed: 20,
    message_text: 'Hi Alex — your share is $20.00.',
    channel: 'sms',
    payment_links: [{ provider: 'venmo', label: 'Venmo', url: 'https://venmo.com/test' }],
    split_image_url: 'https://example.com/split-p1.png',
  },
  {
    participant_id: 'p2',
    display_name: 'Jordan',
    amount_owed: 25,
    message_text: 'Hi Jordan — your share is $25.00.',
    channel: 'sms',
    payment_links: [],
    split_image_url: null,
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

  it('keeps Send to all disabled until every participant is previewed', async () => {
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
    expect(send.props.accessibilityState?.disabled ?? send.props.disabled).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Preview message for Jordan'));

    await waitFor(() => {
      const enabledSend = screen.getByLabelText('Send to all');
      expect(enabledSend.props.accessibilityState?.disabled ?? enabledSend.props.disabled).toBeFalsy();
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
