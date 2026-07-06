/** Navigation diagnostics — single hook if we add Sentry/breadcrumb logging later. */
export function logNavigationWarning(message: string): void {
  if (__DEV__) {
    console.warn(message);
  }
}
