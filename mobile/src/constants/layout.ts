/** Visible tab bar content height (icons + labels), excluding system inset. */
export const TAB_BAR_CONTENT_HEIGHT = 56;

export function tabBarTotalHeight(bottomInset: number): number {
  return TAB_BAR_CONTENT_HEIGHT + bottomInset;
}

/** Bottom offset for FABs sitting above the tab bar. */
export function fabBottomOffset(bottomInset: number): number {
  return tabBarTotalHeight(bottomInset) + 16;
}

/** Scroll content padding below last item, above tab bar. */
export function screenScrollBottomPadding(bottomInset: number): number {
  return tabBarTotalHeight(bottomInset) + 24;
}
