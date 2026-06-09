import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import * as Contacts from 'expo-contacts';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AddParticipantModal } from '../../../components/events/AddParticipantModal';

describe('AddParticipantModal', () => {
  const onSubmit = jest.fn();
  const onClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(Contacts.requestPermissionsAsync).mockResolvedValue({ status: 'granted' } as never);
    jest.mocked(Contacts.presentContactPickerAsync).mockResolvedValue({
      firstName: 'Jordan',
      lastName: 'Lee',
      phoneNumbers: [{ number: '+1 202 555 0100' }],
    } as never);
  });

  it('shows From contacts / Enter manually choice', () => {
    render(
      <AddParticipantModal
        visible
        isSubmitting={false}
        error={null}
        onClose={onClose}
        onSubmit={onSubmit}
      />,
    );

    expect(screen.getByText('From contacts')).toBeTruthy();
    expect(screen.getByText('Enter manually')).toBeTruthy();
  });

  it('Enter manually path renders existing form', () => {
    render(
      <AddParticipantModal
        visible
        isSubmitting={false}
        error={null}
        onClose={onClose}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.press(screen.getByText('Enter manually'));

    expect(screen.getByPlaceholderText('Alex')).toBeTruthy();
    expect(screen.getByText('Name only (no phone)')).toBeTruthy();
    expect(screen.getByText('Add to group')).toBeTruthy();
  });

  it('contact picker success calls onSubmit with E.164 phone', async () => {
    render(
      <AddParticipantModal
        visible
        isSubmitting={false}
        error={null}
        onClose={onClose}
        onSubmit={onSubmit}
      />,
    );

    await act(async () => {
      fireEvent.press(screen.getByText('From contacts'));
    });

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        display_name: 'Jordan Lee',
        join_method: 'manual_phone',
        phone_e164: '+12025550100',
      });
    });
  });

  it('shows message when contacts permission is denied', async () => {
    jest.mocked(Contacts.requestPermissionsAsync).mockResolvedValue({ status: 'denied' } as never);

    render(
      <AddParticipantModal
        visible
        isSubmitting={false}
        error={null}
        onClose={onClose}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.press(screen.getByText('From contacts'));

    await waitFor(() => {
      expect(screen.getByText(/Contacts access is off/)).toBeTruthy();
      expect(screen.getByText('Open Settings')).toBeTruthy();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
