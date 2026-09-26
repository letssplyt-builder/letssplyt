import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import { EventDetailSkeleton } from '../../../components/events/EventDetailSkeleton';

describe('EventDetailSkeleton', () => {
  it('announces a loading event placeholder', () => {
    render(<EventDetailSkeleton />);
    expect(screen.getByLabelText('Loading event')).toBeTruthy();
  });
});
