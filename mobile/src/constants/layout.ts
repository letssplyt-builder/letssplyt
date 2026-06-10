import { Platform } from 'react-native';
import type { ViewStyle } from 'react-native';

/** Top padding inside the tab bar (above icons). */
export const TAB_BAR_PADDING_TOP = 6;

/** Icon + label row height inside the tab bar (excludes padding and system inset). */
export const TAB_BAR_CONTENT_HEIGHT = 48;

/** Breathing room between floating tab bar and sticky footer CTAs. */
export const TAB_BAR_FOOTER_GAP = 16;

/** Gap between keyboard top edge and bottom sheet content when keyboard is open. */
export const KEYBOARD_SHEET_GAP = 12;

/**
 * Android edge-to-edge often reports 0 bottom inset while system nav buttons are visible.
 * Use a conservative minimum so tab labels and footers stay above on-screen controls.
 */
export const ANDROID_MIN_BOTTOM_INSET = 36;

/** Extra space below tab labels inside the tab bar chrome. */
export const TAB_BAR_LABEL_CLEARANCE = 6;

/** Breathing room below auth/onboarding footer CTAs (above system inset). */
export const SYSTEM_FOOTER_EXTRA_PAD = 24;

export function resolveBottomInset(rawInset: number): number {
  if (Platform.OS === 'android') {
    return Math.max(rawInset, ANDROID_MIN_BOTTOM_INSET);
  }
  return rawInset;
}

/** Tab bar chrome above the system bottom inset (icons + labels). */
export function tabBarContentHeight(): number {
  return TAB_BAR_PADDING_TOP + TAB_BAR_CONTENT_HEIGHT;
}

/** Bottom padding inside the tab bar (system inset + label clearance). */
export function tabBarPaddingBottom(rawBottomInset: number): number {
  return resolveBottomInset(rawBottomInset) + TAB_BAR_LABEL_CLEARANCE;
}

/** Full floating tab bar height from the physical bottom of the screen. */
export function tabBarTotalHeight(rawBottomInset: number): number {
  return tabBarContentHeight() + tabBarPaddingBottom(rawBottomInset);
}

/**
 * Footer padding for auth screens without the tab bar.
 * When the OS reports a bottom inset, SafeAreaView handles it — only add breathing room.
 */
export function systemFooterPadding(rawBottomInset: number): number {
  if (rawBottomInset > 0) {
    return SYSTEM_FOOTER_EXTRA_PAD;
  }
  return resolveBottomInset(rawBottomInset) + SYSTEM_FOOTER_EXTRA_PAD;
}

/** Bottom offset for FABs sitting above the tab bar. */
export function fabBottomOffset(rawBottomInset: number): number {
  return tabBarTotalHeight(rawBottomInset) + 16;
}

/** Padding below sticky footer CTAs to clear the floating tab bar. */
export function stickyFooterPadding(rawBottomInset: number): number {
  return tabBarTotalHeight(rawBottomInset) + TAB_BAR_FOOTER_GAP;
}

/**
 * Footer style for sticky split CTAs inside AuthGradientLayout.
 * Layout excludes bottom safe-area edge — padding accounts for tab bar + system inset.
 */
export function splitActionBarFooterStyle(rawBottomInset: number): ViewStyle {
  return {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: stickyFooterPadding(rawBottomInset),
  };
}

/** Scroll content padding below last item, above tab bar. */
export function screenScrollBottomPadding(rawBottomInset: number): number {
  return tabBarTotalHeight(rawBottomInset) + 24;
}

/** Lift for bottom sheets when the keyboard is visible. */
export function keyboardSheetLift(keyboardHeight: number, rawBottomInset: number): number {
  if (keyboardHeight <= 0) return 0;
  const inset = resolveBottomInset(rawBottomInset);
  const base =
    Platform.OS === 'ios' ? Math.max(0, keyboardHeight - inset) : keyboardHeight;
  return base + KEYBOARD_SHEET_GAP;
}
