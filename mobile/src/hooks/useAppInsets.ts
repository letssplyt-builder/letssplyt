import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  fabBottomOffset,
  resolveBottomInset,
  screenScrollBottomPadding,
  stickyFooterPadding,
  tabBarPaddingBottom,
  tabBarTotalHeight,
} from '../constants/layout';

/** Resolved safe-area + layout offsets used across tab screens, footers, and FABs. */
export function useAppInsets() {
  const raw = useSafeAreaInsets();
  const bottom = resolveBottomInset(raw.bottom);

  return {
    top: raw.top,
    left: raw.left,
    right: raw.right,
    /** Bottom inset after Android minimum is applied. */
    bottom,
    /** Unresolved value from safe-area-context. */
    rawBottom: raw.bottom,
    tabBarPaddingBottom: tabBarPaddingBottom(raw.bottom),
    tabBarTotalHeight: tabBarTotalHeight(raw.bottom),
    stickyFooterPadding: stickyFooterPadding(raw.bottom),
    screenScrollBottomPadding: screenScrollBottomPadding(raw.bottom),
    fabBottomOffset: fabBottomOffset(raw.bottom),
  };
}
