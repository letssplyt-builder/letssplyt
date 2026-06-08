export interface JoinCountryOption {
  code: string;
  dial: string;
  label: string;
}

export const JOIN_COUNTRY_OPTIONS: readonly JoinCountryOption[] = [
  { code: 'US', dial: '+1', label: 'US +1' },
  { code: 'CA', dial: '+1', label: 'CA +1' },
  { code: 'GB', dial: '+44', label: 'UK +44' },
  { code: 'AU', dial: '+61', label: 'AU +61' },
  { code: 'IN', dial: '+91', label: 'IN +91' },
  { code: 'DE', dial: '+49', label: 'DE +49' },
  { code: 'FR', dial: '+33', label: 'FR +33' },
  { code: 'SG', dial: '+65', label: 'SG +65' },
  { code: 'AE', dial: '+971', label: 'AE +971' },
] as const;

export function defaultDialForCountry(code: string): string {
  return JOIN_COUNTRY_OPTIONS.find((c) => c.code === code)?.dial ?? '+1';
}
