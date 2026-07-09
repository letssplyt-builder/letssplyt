/** Navigation diagnostics — single hook if we add Sentry/breadcrumb logging later. */
export function logNavigationWarning(message: string): void {
  if (__DEV__) {
    // eslint-disable-next-line no-console -- dev-only navigation breadcrumb
    console.warn(message);
  }
}
