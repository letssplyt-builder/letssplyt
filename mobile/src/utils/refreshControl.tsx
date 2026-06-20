import type { ReactElement } from 'react';
import { Platform, RefreshControl, type RefreshControlProps } from 'react-native';

/**
 * Native Android RefreshControl on ScrollView can crash during nested stack
 * transitions when child views are removed (getChildDrawingOrder bug).
 * iOS keeps pull-to-refresh; Android relies on focus/tab refresh instead.
 */
export function appRefreshControl(
  props: RefreshControlProps,
): ReactElement<RefreshControlProps> | undefined {
  if (Platform.OS === 'android') {
    return undefined;
  }
  return <RefreshControl {...props} />;
}
