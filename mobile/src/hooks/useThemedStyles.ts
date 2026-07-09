import { useMemo } from 'react';
import { makeThemedStyles } from '../theme/makeThemedStyles';
import { useTheme } from '../theme/ThemeContext';

export function useThemedStyles() {
  const { theme } = useTheme();
  return useMemo(() => makeThemedStyles(theme), [theme]);
}
