import { describe, it, expect, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { WelcomeScreen } from './WelcomeScreen';

describe('WelcomeScreen', () => {
  it('renders with Get Started button', () => {
    render(
      <WelcomeScreen
        navigation={{ navigate: jest.fn() } as never}
        route={{ key: 'Welcome', name: 'Welcome', params: undefined } as never}
      />,
    );
    expect(screen.getByText('LetsSplyt')).toBeTruthy();
    expect(screen.getByText('Split Bills, Not Friendships')).toBeTruthy();
    expect(screen.getByText('Get Started')).toBeTruthy();
  });

  it('navigates to PhoneEntry in register mode when Get Started is pressed', () => {
    const navigate = jest.fn();
    render(
      <WelcomeScreen
        navigation={{ navigate } as never}
        route={{ key: 'Welcome', name: 'Welcome', params: undefined } as never}
      />,
    );

    fireEvent.press(screen.getByText('Get Started'));
    expect(navigate).toHaveBeenCalledWith('PhoneEntry', { mode: 'register' });
  });
});
