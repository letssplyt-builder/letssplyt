import { useMemo } from 'react';
import { makeCenteredCardModalStyles } from '../components/layout/CenteredCardModal';
import { useTheme } from '../theme/ThemeContext';

export function useCenteredCardModalStyles() {
  const { theme } = useTheme();
  return useMemo(() => makeCenteredCardModalStyles(theme), [theme]);
}
