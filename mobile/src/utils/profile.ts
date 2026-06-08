import type { PaymentProvider } from '@letssplyt/shared/profile.types';

export function initialsFromDisplayName(displayName: string): string {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase();
}

/** MVP payment providers shown in the app (US-focused). */
export const PROVIDER_OPTIONS: Array<{
  id: PaymentProvider;
  label: string;
  placeholder: string;
  badge: string;
  color: string;
}> = [
  { id: 'venmo', label: 'Venmo', placeholder: '@username', badge: 'V', color: '#3D95CE' },
  { id: 'paypal', label: 'PayPal', placeholder: 'paypal.me/username', badge: 'PP', color: '#003087' },
  { id: 'cashapp', label: 'Cash App', placeholder: '$cashtag', badge: '$', color: '#00D632' },
  { id: 'zelle', label: 'Zelle', placeholder: 'phone or email', badge: 'Z', color: '#6D1ED4' },
];

export function providerLabel(provider: PaymentProvider): string {
  return PROVIDER_OPTIONS.find((option) => option.id === provider)?.label ?? provider;
}

export function providerVisual(provider: PaymentProvider) {
  return (
    PROVIDER_OPTIONS.find((option) => option.id === provider) ?? {
      id: provider,
      label: provider,
      placeholder: '',
      badge: '?',
      color: '#64748B',
    }
  );
}
