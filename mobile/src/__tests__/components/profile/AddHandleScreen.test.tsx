import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AddHandleScreen } from '../../../screens/profile/AddHandleScreen';
import { ApiRequestError } from '../../../services/api';
import { useProfileStore } from '../../../store/profileStore';

const mockGoBack = jest.fn();
const mockNavigate = jest.fn();
const mockNavigation = { goBack: mockGoBack, navigate: mockNavigate };
const mockRoute = { key: 'AddHandle', name: 'AddHandle' as const, params: {} };

describe('AddHandleScreen', () => {
  beforeEach(() => {
    useProfileStore.setState({ user: null, handles: [], isLoading: false });
    jest.clearAllMocks();
  });

  it('renders MVP provider chip options only', () => {
    render(<AddHandleScreen navigation={mockNavigation as never} route={mockRoute as never} />);

    expect(screen.getByText('Venmo')).toBeTruthy();
    expect(screen.getByText('PayPal')).toBeTruthy();
    expect(screen.getByText('Cash App')).toBeTruthy();
    expect(screen.getByText('Zelle')).toBeTruthy();
    expect(screen.queryByText('Wise')).toBeNull();
    expect(screen.queryByText('Bank Transfer')).toBeNull();
    expect(screen.queryByText('Other')).toBeNull();
  });

  it('selects Venmo by default with matching placeholder', () => {
    render(<AddHandleScreen navigation={mockNavigation as never} route={mockRoute as never} />);
    expect(screen.getByPlaceholderText('@username')).toBeTruthy();
  });

  it('selecting a provider chip updates the input placeholder text', () => {
    render(<AddHandleScreen navigation={mockNavigation as never} route={mockRoute as never} />);
    fireEvent.press(screen.getByText('PayPal'));
    expect(screen.getByPlaceholderText('paypal.me/username')).toBeTruthy();
  });

  it('shows validation error for an invalid Venmo handle', async () => {
    const addHandleSpy = jest
      .spyOn(useProfileStore.getState(), 'addHandle')
      .mockResolvedValue();

    render(<AddHandleScreen navigation={mockNavigation as never} route={mockRoute as never} />);
    fireEvent.changeText(screen.getByPlaceholderText('@username'), '!!!');
    fireEvent.press(screen.getByText('Save'));

    expect(screen.getByText(/Venmo usernames are 5–30 characters/)).toBeTruthy();
    expect(addHandleSpy).not.toHaveBeenCalled();
    addHandleSpy.mockRestore();
  });

  it('Save button is disabled when handle_value is empty', () => {
    const addHandleSpy = jest
      .spyOn(useProfileStore.getState(), 'addHandle')
      .mockResolvedValue();

    render(<AddHandleScreen navigation={mockNavigation as never} route={mockRoute as never} />);
    fireEvent.press(screen.getByText('Save'));

    expect(addHandleSpy).not.toHaveBeenCalled();
    addHandleSpy.mockRestore();
  });

  it('pressing Save calls profile service addHandle with correct provider and handle_value', async () => {
    const addHandleSpy = jest
      .spyOn(useProfileStore.getState(), 'addHandle')
      .mockResolvedValue();

    render(<AddHandleScreen navigation={mockNavigation as never} route={mockRoute as never} />);
    fireEvent.changeText(screen.getByPlaceholderText('@username'), '@testhandle');
    fireEvent.press(screen.getByText('Save'));

    await waitFor(() => {
      expect(addHandleSpy).toHaveBeenCalledWith('venmo', '@testhandle');
    });

    addHandleSpy.mockRestore();
  });

  it('navigates to Profile with toast after successful save', async () => {
    jest.spyOn(useProfileStore.getState(), 'addHandle').mockResolvedValue();

    render(<AddHandleScreen navigation={mockNavigation as never} route={mockRoute as never} />);
    fireEvent.changeText(screen.getByPlaceholderText('@username'), '@testhandle');
    fireEvent.press(screen.getByText('Save'));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('Profile', {
        toastMessage: 'Payment method added successfully',
      });
    });
  });

  it('shows inline error when provider already exists on profile', async () => {
    jest.spyOn(useProfileStore.getState(), 'addHandle').mockRejectedValue(
      new ApiRequestError(
        'DUPLICATE_PROVIDER',
        'You already have an active handle for this provider',
        409,
      ),
    );

    render(<AddHandleScreen navigation={mockNavigation as never} route={mockRoute as never} />);
    fireEvent.changeText(screen.getByPlaceholderText('@username'), '@testhandle');
    fireEvent.press(screen.getByText('Save'));

    await waitFor(() => {
      expect(screen.getByText(/You already have Venmo on your profile/)).toBeTruthy();
    });
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('edit mode calls updateHandle instead of addHandle', async () => {
    const updateHandleSpy = jest
      .spyOn(useProfileStore.getState(), 'updateHandle')
      .mockResolvedValue();

    const editRoute = {
      key: 'AddHandle',
      name: 'AddHandle' as const,
      params: {
        handleId: 'handle-1',
        provider: 'paypal' as const,
        handleValue: 'paypal.me/old',
      },
    };

    render(<AddHandleScreen navigation={mockNavigation as never} route={editRoute as never} />);
    fireEvent.changeText(screen.getByPlaceholderText('paypal.me/username'), 'paypal.me/newname');
    fireEvent.press(screen.getByText('Save'));

    await waitFor(() => {
      expect(updateHandleSpy).toHaveBeenCalledWith('handle-1', 'paypal.me/newname');
    });

    updateHandleSpy.mockRestore();
  });
});
