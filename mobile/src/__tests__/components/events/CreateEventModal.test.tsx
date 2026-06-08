import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { CreateEventModal } from '../../../components/events/CreateEventModal';

describe('CreateEventModal', () => {
  const onCreate = jest.fn();
  const onClose = jest.fn();
  const onTitleChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders name input autofocused', () => {
    render(
      <CreateEventModal
        visible
        title=""
        isCreating={false}
        error={null}
        onTitleChange={onTitleChange}
        onClose={onClose}
        onCreate={onCreate}
      />,
    );

    const input = screen.getByPlaceholderText('Friday Dinner');
    expect(input.props.autoFocus).toBe(true);
  });

  it('Create button calls event service', () => {
    render(
      <CreateEventModal
        visible
        title="Friday Dinner"
        isCreating={false}
        error={null}
        onTitleChange={onTitleChange}
        onClose={onClose}
        onCreate={onCreate}
      />,
    );

    fireEvent.press(screen.getByText('Create event →'));
    expect(onCreate).toHaveBeenCalled();
  });

  it('shows loading while creating', () => {
    render(
      <CreateEventModal
        visible
        title="Friday Dinner"
        isCreating
        error={null}
        onTitleChange={onTitleChange}
        onClose={onClose}
        onCreate={onCreate}
      />,
    );

    expect(screen.queryByText('Create event →')).toBeNull();
  });

  it('dismisses on success via parent close handler', () => {
    const { rerender } = render(
      <CreateEventModal
        visible
        title="Friday Dinner"
        isCreating
        error={null}
        onTitleChange={onTitleChange}
        onClose={onClose}
        onCreate={onCreate}
      />,
    );

    rerender(
      <CreateEventModal
        visible={false}
        title=""
        isCreating={false}
        error={null}
        onTitleChange={onTitleChange}
        onClose={onClose}
        onCreate={onCreate}
      />,
    );

    expect(screen.queryByText('New event')).toBeNull();
  });
});
