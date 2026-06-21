import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import * as Contacts from 'expo-contacts';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AddMembersSheet } from '../../../components/events/AddMembersSheet';

describe('AddMembersSheet', () => {
  const onSubmitBatch = jest.fn(async () => ({ added: [], failed: [] }));
  const onClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(Contacts.requestPermissionsAsync).mockResolvedValue({ status: 'granted' } as never);
    jest.mocked(Contacts.getContactsAsync).mockResolvedValue({
      data: [
        {
          id: 'c1',
          firstName: 'Jordan',
          lastName: 'Lee',
          phoneNumbers: [{ number: '+1 202 555 0100' }],
        },
        {
          id: 'c2',
          firstName: 'Sam',
          lastName: 'Taylor',
          phoneNumbers: [{ number: '+1 202 555 0200' }],
        },
      ],
    } as never);
  });

  it('shows Contacts and By name tabs', async () => {
    render(
      <AddMembersSheet
        visible
        isSubmitting={false}
        submitError={null}
        existingParticipants={[]}
        onClose={onClose}
        onSubmitBatch={onSubmitBatch}
      />,
    );

    expect(screen.getByText('Add members')).toBeTruthy();
    expect(screen.getByText('Contacts')).toBeTruthy();
    expect(screen.getByText('By name')).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByText('Jordan Lee')).toBeTruthy();
    });
  });

  it('keeps Done disabled until at least one member is ready', async () => {
    render(
      <AddMembersSheet
        visible
        isSubmitting={false}
        submitError={null}
        existingParticipants={[]}
        onClose={onClose}
        onSubmitBatch={onSubmitBatch}
      />,
    );

    const doneButton = screen.getByLabelText('Done');
    expect(doneButton.props.accessibilityState?.disabled).toBe(true);
  });

  it('Done adds selected contacts and closes on success', async () => {
    onSubmitBatch.mockResolvedValueOnce({
      added: [
        {
          display_name: 'Jordan Lee',
          join_method: 'manual_phone',
          phone_e164: '+12025550100',
        },
      ],
      failed: [],
    });

    render(
      <AddMembersSheet
        visible
        isSubmitting={false}
        submitError={null}
        existingParticipants={[]}
        onClose={onClose}
        onSubmitBatch={onSubmitBatch}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Jordan Lee')).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText('Jordan Lee'));
    fireEvent.press(screen.getByText('Done · add 1 member'));

    await waitFor(() => {
      expect(onSubmitBatch).toHaveBeenCalledWith([
        {
          display_name: 'Jordan Lee',
          join_method: 'manual_phone',
          phone_e164: '+12025550100',
        },
      ]);
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('deselects a contact when tapped again', async () => {
    render(
      <AddMembersSheet
        visible
        isSubmitting={false}
        submitError={null}
        existingParticipants={[]}
        onClose={onClose}
        onSubmitBatch={onSubmitBatch}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Jordan Lee')).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText('Jordan Lee'));
    expect(screen.getByLabelText('Jordan Lee, selected')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Jordan Lee, selected'));
    expect(screen.getByLabelText('Jordan Lee')).toBeTruthy();
    expect(screen.getByLabelText('Done').props.accessibilityState?.disabled).toBe(true);
  });

  it('filters contacts by search query', async () => {
    render(
      <AddMembersSheet
        visible
        isSubmitting={false}
        submitError={null}
        existingParticipants={[]}
        onClose={onClose}
        onSubmitBatch={onSubmitBatch}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Jordan Lee')).toBeTruthy();
    });

    fireEvent.changeText(screen.getByLabelText('Search contacts'), 'Sam');

    await waitFor(() => {
      expect(screen.queryByText('Jordan Lee')).toBeNull();
      expect(screen.getByText('Sam Taylor')).toBeTruthy();
    });
  });

  it('shows settings notice when contacts permission is denied', async () => {
    jest.mocked(Contacts.requestPermissionsAsync).mockResolvedValue({ status: 'denied' } as never);

    render(
      <AddMembersSheet
        visible
        isSubmitting={false}
        submitError={null}
        existingParticipants={[]}
        onClose={onClose}
        onSubmitBatch={onSubmitBatch}
      />,
    );

    await waitFor(() => {
      expect(
        screen.getByText(/Contacts access is off. Switch to By name or enable contacts in Settings./),
      ).toBeTruthy();
    });
  });

  it('By name tab shows one person field initially and submits on Done', async () => {
    render(
      <AddMembersSheet
        visible
        isSubmitting={false}
        submitError={null}
        existingParticipants={[]}
        onClose={onClose}
        onSubmitBatch={onSubmitBatch}
      />,
    );

    fireEvent.press(screen.getByText('By name'));
    expect(screen.getByLabelText('Person 1 name')).toBeTruthy();
    expect(screen.queryByLabelText('Person 2 name')).toBeNull();

    fireEvent.changeText(screen.getByLabelText('Person 1 name'), 'Chris');
    fireEvent.press(screen.getByText('Done · add 1 member'));

    await waitFor(() => {
      expect(onSubmitBatch).toHaveBeenCalledWith([
        { display_name: 'Chris', join_method: 'manual_name_only' },
      ]);
    });
  });

  it('By name tab submits name with optional phone', async () => {
    render(
      <AddMembersSheet
        visible
        isSubmitting={false}
        submitError={null}
        existingParticipants={[]}
        onClose={onClose}
        onSubmitBatch={onSubmitBatch}
      />,
    );

    fireEvent.press(screen.getByText('By name'));
    fireEvent.changeText(screen.getByLabelText('Person 1 name'), 'Chris');
    fireEvent.changeText(screen.getByLabelText('Person 1 phone, optional'), '2025550199');
    fireEvent.press(screen.getByText('Done · add 1 member'));

    await waitFor(() => {
      expect(onSubmitBatch).toHaveBeenCalledWith([
        {
          display_name: 'Chris',
          join_method: 'manual_phone',
          phone_e164: '+12025550199',
        },
      ]);
    });
  });

  it('By name tab adds another person row when link is pressed', async () => {
    render(
      <AddMembersSheet
        visible
        isSubmitting={false}
        submitError={null}
        existingParticipants={[]}
        onClose={onClose}
        onSubmitBatch={onSubmitBatch}
      />,
    );

    fireEvent.press(screen.getByText('By name'));
    fireEvent.press(screen.getByText('+ Add another person'));

    expect(screen.getByLabelText('Person 2 name')).toBeTruthy();
  });

  it('rejects invalid phone when a name is provided', async () => {
    render(
      <AddMembersSheet
        visible
        isSubmitting={false}
        submitError={null}
        existingParticipants={[]}
        onClose={onClose}
        onSubmitBatch={onSubmitBatch}
      />,
    );

    fireEvent.press(screen.getByText('By name'));
    fireEvent.changeText(screen.getByLabelText('Person 1 name'), 'Chris');
    fireEvent.changeText(screen.getByLabelText('Person 1 phone, optional'), '123');
    fireEvent.press(screen.getByText('Done · add 1 member'));

    await waitFor(() => {
      expect(
        screen.getByText('Enter a valid phone for Chris or leave phone blank.'),
      ).toBeTruthy();
    });
    expect(onSubmitBatch).not.toHaveBeenCalled();
  });

  it('skips names already on the event', async () => {
    render(
      <AddMembersSheet
        visible
        isSubmitting={false}
        submitError={null}
        existingParticipants={[{ display_name: 'Chris' }]}
        onClose={onClose}
        onSubmitBatch={onSubmitBatch}
      />,
    );

    fireEvent.press(screen.getByText('By name'));
    fireEvent.changeText(screen.getByLabelText('Person 1 name'), 'Chris');
    fireEvent.press(screen.getByText('Done · add 1 member'));

    await waitFor(() => {
      expect(screen.getByText('Everyone selected is already on this event.')).toBeTruthy();
    });
    expect(onSubmitBatch).not.toHaveBeenCalled();
  });

  it('merges contacts and manual rows in one batch', async () => {
    render(
      <AddMembersSheet
        visible
        isSubmitting={false}
        submitError={null}
        existingParticipants={[]}
        onClose={onClose}
        onSubmitBatch={onSubmitBatch}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Jordan Lee')).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText('Jordan Lee'));
    fireEvent.press(screen.getByText('By name'));
    fireEvent.changeText(screen.getByLabelText('Person 1 name'), 'Chris');
    fireEvent.press(screen.getByText('Done · add 2 members'));

    await waitFor(() => {
      expect(onSubmitBatch).toHaveBeenCalledWith(
        expect.arrayContaining([
          {
            display_name: 'Jordan Lee',
            join_method: 'manual_phone',
            phone_e164: '+12025550100',
          },
          { display_name: 'Chris', join_method: 'manual_name_only' },
        ]),
      );
    });
  });

  it('stays open and shows error when batch add fails entirely', async () => {
    onSubmitBatch.mockResolvedValueOnce({
      added: [],
      failed: [{ entry: { display_name: 'Chris', join_method: 'manual_name_only' }, message: 'Failed' }],
    });

    render(
      <AddMembersSheet
        visible
        isSubmitting={false}
        submitError={null}
        existingParticipants={[]}
        onClose={onClose}
        onSubmitBatch={onSubmitBatch}
      />,
    );

    fireEvent.press(screen.getByText('By name'));
    fireEvent.changeText(screen.getByLabelText('Person 1 name'), 'Chris');
    fireEvent.press(screen.getByText('Done · add 1 member'));

    await waitFor(() => {
      expect(screen.getByText('Could not add: Chris')).toBeTruthy();
    });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes when at least one member is added even if others fail', async () => {
    onSubmitBatch.mockResolvedValueOnce({
      added: [{ display_name: 'Chris', join_method: 'manual_name_only' }],
      failed: [{ entry: { display_name: 'Sam', join_method: 'manual_name_only' }, message: 'Failed' }],
    });

    render(
      <AddMembersSheet
        visible
        isSubmitting={false}
        submitError={null}
        existingParticipants={[]}
        onClose={onClose}
        onSubmitBatch={onSubmitBatch}
      />,
    );

    fireEvent.press(screen.getByText('By name'));
    fireEvent.changeText(screen.getByLabelText('Person 1 name'), 'Chris');
    fireEvent.press(screen.getByText('Done · add 1 member'));

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('shows submitError from parent', () => {
    render(
      <AddMembersSheet
        visible
        isSubmitting={false}
        submitError="Network error"
        existingParticipants={[]}
        onClose={onClose}
        onSubmitBatch={onSubmitBatch}
      />,
    );

    expect(screen.getByText('Network error')).toBeTruthy();
  });

  it('resets state when reopened', async () => {
    const { rerender } = render(
      <AddMembersSheet
        visible
        isSubmitting={false}
        submitError={null}
        existingParticipants={[]}
        onClose={onClose}
        onSubmitBatch={onSubmitBatch}
      />,
    );

    fireEvent.press(screen.getByText('By name'));
    fireEvent.changeText(screen.getByLabelText('Person 1 name'), 'Chris');

    rerender(
      <AddMembersSheet
        visible={false}
        isSubmitting={false}
        submitError={null}
        existingParticipants={[]}
        onClose={onClose}
        onSubmitBatch={onSubmitBatch}
      />,
    );

    rerender(
      <AddMembersSheet
        visible
        isSubmitting={false}
        submitError={null}
        existingParticipants={[]}
        onClose={onClose}
        onSubmitBatch={onSubmitBatch}
      />,
    );

    fireEvent.press(screen.getByText('By name'));
    expect(screen.getByLabelText('Person 1 name').props.value).toBe('');
  });
});
