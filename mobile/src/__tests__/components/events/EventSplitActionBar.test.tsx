import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { View } from 'react-native';
import { EventSplitActionBar } from '../../../components/events/EventSplitActionBar';

const baseHandlers = {
  onScanReceipt: jest.fn(),
  onEnterTotal: jest.fn(),
  onReviewItems: jest.fn(),
  onEditShare: jest.fn(),
  onSendMessages: jest.fn(),
};

type StyleTree = Record<string, unknown>;

function flattenStyles(style: unknown): StyleTree[] {
  if (!style) return [];
  if (Array.isArray(style)) return style.flatMap((entry) => flattenStyles(entry));
  if (typeof style === 'object') return [style as StyleTree];
  return [];
}

function hasFlexOne(styles: StyleTree[]): boolean {
  return styles.some((style) => style.flex === 1);
}

function viewsWithFlexDirection(views: View[], direction: 'row' | 'column'): View[] {
  return views.filter((view) =>
    flattenStyles(view.props.style).some((style) => style.flexDirection === direction),
  );
}

function buttonStyles(accessibilityLabel: string): StyleTree[] {
  return flattenStyles(screen.getByLabelText(accessibilityLabel).props.style);
}

describe('EventSplitActionBar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('initial mode (locked, no receipt)', () => {
    it('shows Scan receipt and Enter total with accessible labels', () => {
      render(
        <EventSplitActionBar
          mode="initial"
          canSendMessages={false}
          {...baseHandlers}
        />,
      );

      expect(screen.getByLabelText('Scan receipt for itemised split')).toBeTruthy();
      expect(screen.getByLabelText('Enter total for custom split')).toBeTruthy();
    });

    it('uses a row layout so paired flex buttons keep visible height in the sticky footer', () => {
      const { UNSAFE_getAllByType } = render(
        <EventSplitActionBar
          mode="initial"
          canSendMessages={false}
          {...baseHandlers}
        />,
      );

      const rowLayouts = viewsWithFlexDirection(UNSAFE_getAllByType(View), 'row');
      expect(rowLayouts.length).toBeGreaterThan(0);
      expect(hasFlexOne(buttonStyles('Scan receipt for itemised split'))).toBe(true);
      expect(hasFlexOne(buttonStyles('Enter total for custom split'))).toBe(true);
    });

    it('fires scan and enter handlers when pressed', () => {
      render(
        <EventSplitActionBar
          mode="initial"
          canSendMessages={false}
          {...baseHandlers}
        />,
      );

      fireEvent.press(screen.getByLabelText('Scan receipt for itemised split'));
      fireEvent.press(screen.getByLabelText('Enter total for custom split'));

      expect(baseHandlers.onScanReceipt).toHaveBeenCalledTimes(1);
      expect(baseHandlers.onEnterTotal).toHaveBeenCalledTimes(1);
    });
  });

  describe('parsing mode', () => {
    it('shows disabled Reading receipt button without flex:1 collapse styles', () => {
      render(
        <EventSplitActionBar
          mode="parsing"
          canSendMessages={false}
          {...baseHandlers}
        />,
      );

      const reading = screen.getByLabelText('Reading receipt');
      expect(reading.props.accessibilityState?.disabled ?? reading.props.disabled).toBeTruthy();
      expect(hasFlexOne(flattenStyles(reading.props.style))).toBe(false);
    });
  });

  describe('review mode', () => {
    it('shows Review items only', () => {
      render(
        <EventSplitActionBar
          mode="review"
          canSendMessages={false}
          {...baseHandlers}
        />,
      );

      expect(screen.getByLabelText('Review receipt items')).toBeTruthy();
      expect(screen.queryByLabelText('Scan receipt for itemised split')).toBeNull();
      expect(screen.queryByLabelText('Enter total for custom split')).toBeNull();
    });

    it('calls onReviewItems when pressed', () => {
      render(
        <EventSplitActionBar
          mode="review"
          canSendMessages={false}
          {...baseHandlers}
        />,
      );

      fireEvent.press(screen.getByLabelText('Review receipt items'));
      expect(baseHandlers.onReviewItems).toHaveBeenCalledTimes(1);
    });
  });

  describe('failed mode', () => {
    it('stacks retry actions without flex:1 (avoids zero-height collapse)', () => {
      const { UNSAFE_getAllByType } = render(
        <EventSplitActionBar
          mode="failed"
          canSendMessages={false}
          {...baseHandlers}
        />,
      );

      expect(screen.getByLabelText('Scan receipt again')).toBeTruthy();
      expect(screen.getByLabelText('Enter total for custom split')).toBeTruthy();
      expect(hasFlexOne(buttonStyles('Scan receipt again'))).toBe(false);
      expect(hasFlexOne(buttonStyles('Enter total for custom split'))).toBe(false);
      expect(viewsWithFlexDirection(UNSAFE_getAllByType(View), 'row').length).toBe(0);
    });
  });

  describe('edit mode', () => {
    it('shows Edit share and Send messages in a row when messages are pending', () => {
      const { UNSAFE_getAllByType } = render(
        <EventSplitActionBar mode="edit" canSendMessages={true} {...baseHandlers} />,
      );

      expect(screen.getByLabelText('Edit split')).toBeTruthy();
      expect(screen.getByLabelText('Preview and send messages')).toBeTruthy();

      expect(viewsWithFlexDirection(UNSAFE_getAllByType(View), 'row').length).toBeGreaterThan(0);
      expect(hasFlexOne(buttonStyles('Edit split'))).toBe(true);
      expect(hasFlexOne(buttonStyles('Preview and send messages'))).toBe(true);
    });

    it('shows full-width Edit share when messages are not ready', () => {
      render(<EventSplitActionBar mode="edit" canSendMessages={false} {...baseHandlers} />);

      expect(screen.getByLabelText('Edit split')).toBeTruthy();
      expect(hasFlexOne(buttonStyles('Edit split'))).toBe(false);
    });

    it('hides Send messages when expenses are not ready', () => {
      render(<EventSplitActionBar mode="edit" canSendMessages={false} {...baseHandlers} />);

      expect(screen.getByLabelText('Edit split')).toBeTruthy();
      expect(screen.queryByLabelText('Preview and send messages')).toBeNull();
    });

    it('fires edit and send handlers', () => {
      render(<EventSplitActionBar mode="edit" canSendMessages={true} {...baseHandlers} />);

      fireEvent.press(screen.getByLabelText('Edit split'));
      fireEvent.press(screen.getByLabelText('Preview and send messages'));

      expect(baseHandlers.onEditShare).toHaveBeenCalledTimes(1);
      expect(baseHandlers.onSendMessages).toHaveBeenCalledTimes(1);
    });
  });
});
