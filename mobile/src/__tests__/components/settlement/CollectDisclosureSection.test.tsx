import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import {
  CollectDisclosureSection,
  collectSectionHeaderLabel,
} from '../../../components/settlement/CollectDisclosureSection';
import { renderWithTheme } from '../../helpers/renderWithTheme';

describe('CollectDisclosureSection', () => {
  it('builds a header with count and total', () => {
    expect(collectSectionHeaderLabel('Members', 3, 48)).toBe('Members · 3 · $48.00');
  });

  it('hides children when collapsed and shows them when expanded', () => {
    const onToggle = jest.fn();
    const { rerender } = renderWithTheme(
      <CollectDisclosureSection
        title="Guests"
        count={1}
        total={18}
        expanded
        onToggle={onToggle}
      >
        <Text>Priya</Text>
      </CollectDisclosureSection>,
    );

    expect(screen.getByText('Guests · 1 · $18.00')).toBeTruthy();
    expect(screen.getByText('Priya')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Guests, 1 person, $18.00'));
    expect(onToggle).toHaveBeenCalledTimes(1);

    rerender(
      <CollectDisclosureSection
        title="Guests"
        count={1}
        total={18}
        expanded={false}
        onToggle={onToggle}
      >
        <Text>Priya</Text>
      </CollectDisclosureSection>,
    );

    expect(screen.queryByText('Priya')).toBeNull();
  });
});
