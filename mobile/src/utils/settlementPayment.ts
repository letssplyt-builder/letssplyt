import type { PaymentProvider } from '@letssplyt/shared/profile.types';
import type { IOwePaymentHandle } from '@letssplyt/shared/settlement.types';
import { Alert, Linking } from 'react-native';
import type { SelfReportPaymentMethod } from '../services/settlement.service';
import { buildPaymentDeepLink, isHttpOrAppUrl } from './paymentDeepLinks';

export function providerToSelfReportMethod(provider: PaymentProvider): SelfReportPaymentMethod {
  switch (provider) {
    case 'venmo':
      return 'venmo';
    case 'paypal':
      return 'paypal';
    case 'cashapp':
      return 'cashapp';
    case 'zelle':
      return 'zelle';
    case 'wise':
      return 'wise';
    case 'bank_transfer':
      return 'bank_transfer';
    default:
      return 'other';
  }
}

export function buildAllPaidMethodOptions(handles: IOwePaymentHandle[]): Array<{
  id: string;
  label: string;
  method: SelfReportPaymentMethod;
}> {
  const options = handles.map((handle) => ({
    id: handle.provider,
    label: handle.handle_display,
    method: providerToSelfReportMethod(handle.provider),
  }));
  options.push({ id: 'cash-other', label: 'Cash/Other', method: 'other' });
  return options;
}

export async function openPaymentDeepLink(url: string, label: string): Promise<void> {
  if (!isHttpOrAppUrl(url)) {
    Alert.alert(label, url);
    return;
  }
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert(label, url);
  }
}

export function buildHandlePaymentOptions(
  handles: IOwePaymentHandle[],
  amount: number,
  eventTitle: string,
) {
  return handles
    .map((handle) => {
      const link = buildPaymentDeepLink(
        handle.provider,
        handle.handle_display,
        amount,
        eventTitle,
      );
      if (!link) return null;
      return { ...link, handleDisplay: handle.handle_display };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);
}
