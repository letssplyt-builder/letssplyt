import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { DeleteConfirmScreen } from '../../../screens/profile/DeleteConfirmScreen';
import { fetchBalance } from '../../../services/event.service';
import * as profileService from '../../../services/profile.service';

jest.mock('../../../services/event.service', () => ({
  fetchBalance: jest.fn(),
}));

const mockGoBack = jest.fn();
const mockReplace = jest.fn();
const mockNavigation = { goBack: mockGoBack, replace: mockReplace };
const mockRoute = { key: 'DeleteConfirm', name: 'DeleteConfirm' as const, params: undefined };
const mockFetchBalance = jest.mocked(fetchBalance);

describe('DeleteConfirmScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchBalance.mockResolvedValue({
      net_balance: 0,
      currency: 'USD',
      owed_to_you: 0,
      you_owe: 0,
    });
  });

  it('delete button disabled initially', async () => {
    render(
      <DeleteConfirmScreen navigation={mockNavigation as never} route={mockRoute as never} />,
    );

    await waitFor(() => {
      const button = screen.getByLabelText('Delete account permanently');
      expect(button.props.accessibilityState?.disabled ?? button.props.disabled).toBe(true);
    });
  });

  it('delete button disabled when text is not exactly DELETE', async () => {
    render(
      <DeleteConfirmScreen navigation={mockNavigation as never} route={mockRoute as never} />,
    );

    await waitFor(() => expect(mockFetchBalance).toHaveBeenCalled());

    fireEvent.changeText(screen.getByPlaceholderText('Type DELETE'), 'REMOVE');
    const button = screen.getByLabelText('Delete account permanently');
    expect(button.props.accessibilityState?.disabled ?? button.props.disabled).toBe(true);
  });

  it('delete button enabled when text is DELETE', async () => {
    render(
      <DeleteConfirmScreen navigation={mockNavigation as never} route={mockRoute as never} />,
    );

    await waitFor(() => expect(mockFetchBalance).toHaveBeenCalled());

    fireEvent.changeText(screen.getByPlaceholderText('Type DELETE'), 'DELETE');
    const button = screen.getByLabelText('Delete account permanently');
    expect(button.props.accessibilityState?.disabled ?? button.props.disabled).not.toBe(true);
  });

  it('calls delete service on tap', async () => {
    const deleteSpy = jest.spyOn(profileService, 'deleteAccount').mockResolvedValue();

    render(
      <DeleteConfirmScreen navigation={mockNavigation as never} route={mockRoute as never} />,
    );

    await waitFor(() => expect(mockFetchBalance).toHaveBeenCalled());

    fireEvent.changeText(screen.getByPlaceholderText('Type DELETE'), 'DELETE');
    fireEvent.press(screen.getByLabelText('Delete account permanently'));

    await waitFor(() => {
      expect(deleteSpy).toHaveBeenCalledTimes(1);
    });

    deleteSpy.mockRestore();
  });

  it('navigates to DeletedScreen on success', async () => {
    jest.spyOn(profileService, 'deleteAccount').mockResolvedValue();

    render(
      <DeleteConfirmScreen navigation={mockNavigation as never} route={mockRoute as never} />,
    );

    await waitFor(() => expect(mockFetchBalance).toHaveBeenCalled());

    fireEvent.changeText(screen.getByPlaceholderText('Type DELETE'), 'DELETE');
    fireEvent.press(screen.getByLabelText('Delete account permanently'));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('Deleted');
    });
  });
});
