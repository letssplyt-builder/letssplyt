import type { ReactElement, ReactNode } from 'react';
import { render, type RenderOptions } from '@testing-library/react-native';
import { ThemeProvider } from '../../theme/ThemeContext';

function Providers({ children }: { children: ReactNode }) {
  return <ThemeProvider>{children}</ThemeProvider>;
}

export function renderWithTheme(ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) {
  return render(ui, { wrapper: Providers, ...options });
}
