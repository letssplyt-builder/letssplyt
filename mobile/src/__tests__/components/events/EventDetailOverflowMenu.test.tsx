import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { EventDetailOverflowMenu } from '../../../components/events/EventDetailOverflowMenu';

describe('EventDetailOverflowMenu', () => {
  it('renders placeholder when no actions are available', () => {
    const { toJSON } = render(<EventDetailOverflowMenu />);
    expect(toJSON()).not.toBeNull();
    expect(screen.queryByLabelText('More options')).toBeNull();
  });

  it('opens dropdown with reopen, reset, and delete actions', () => {
    const onReopen = jest.fn();
    const onReset = jest.fn();
    const onDelete = jest.fn();

    render(
      <EventDetailOverflowMenu
        showReopen
        showReset
        showDelete
        onReopen={onReopen}
        onReset={onReset}
        onDelete={onDelete}
      />,
    );

    fireEvent.press(screen.getByLabelText('More options'));
    fireEvent.press(screen.getByLabelText('Reopen join window'));
    fireEvent.press(screen.getByLabelText('More options'));
    fireEvent.press(screen.getByLabelText('Reset expenses'));
    fireEvent.press(screen.getByLabelText('More options'));
    fireEvent.press(screen.getByLabelText('Delete event'));

    expect(onReopen).toHaveBeenCalledTimes(1);
    expect(onReset).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});
