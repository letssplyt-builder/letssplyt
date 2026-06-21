import type * as Contacts from 'expo-contacts';
import {
  DEFAULT_AUTH_REGION,
  toE164FromNational,
  toE164FromPhoneInput,
} from '../../utils/phone';

export type GroupBuilderSubmitPayload = {
  display_name: string;
  join_method: 'manual_phone' | 'manual_name_only';
  phone_e164?: string;
};

export type GroupBuilderEntry = GroupBuilderSubmitPayload & {
  key: string;
  source: 'contact' | 'manual' | 'paste';
};

export type ManualInputRow = {
  id: string;
  name: string;
  phone: string;
};

export function createManualRowId(): string {
  return `row-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function entryKeyForPayload(payload: GroupBuilderSubmitPayload): string {
  const name = payload.display_name.trim().toLowerCase();
  if (payload.join_method === 'manual_phone' && payload.phone_e164) {
    return `phone:${payload.phone_e164}`;
  }
  return `name:${name}`;
}

export function contactDisplayName(contact: Contacts.Contact): string {
  const fromParts = [contact.firstName, contact.lastName].filter(Boolean).join(' ').trim();
  if (fromParts) return fromParts;
  if (contact.name?.trim()) return contact.name.trim();
  return 'Unknown';
}

export function contactToPayload(contact: Contacts.Contact): GroupBuilderSubmitPayload | null {
  const display_name = contactDisplayName(contact);
  const phoneRaw = contact.phoneNumbers?.[0]?.number?.trim();
  if (!phoneRaw) return null;

  const phone_e164 = toE164FromPhoneInput(phoneRaw);
  if (!phone_e164) return null;

  return {
    display_name,
    join_method: 'manual_phone',
    phone_e164,
  };
}

export function manualRowToPayload(name: string, phone: string): GroupBuilderSubmitPayload | null {
  const display_name = name.trim();
  if (!display_name) return null;

  const phoneDigits = phone.trim();
  if (!phoneDigits) {
    return { display_name, join_method: 'manual_name_only' };
  }

  const phone_e164 = toE164FromNational(phoneDigits, DEFAULT_AUTH_REGION);
  if (!phone_e164) return null;

  return {
    display_name,
    join_method: 'manual_phone',
    phone_e164,
  };
}

export function manualRowHasInvalidPhone(name: string, phone: string): boolean {
  const display_name = name.trim();
  const phoneDigits = phone.trim();
  if (!display_name || !phoneDigits) return false;
  return manualRowToPayload(name, phone) === null;
}

export function parseSingleMemberLine(line: string): GroupBuilderSubmitPayload | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  const phoneSuffix = trimmed.match(/^(.+?)\s+([+(]?[\d][\d\s().-]{6,})$/);
  if (phoneSuffix) {
    const display_name = phoneSuffix[1].trim();
    const phone_e164 = toE164FromPhoneInput(phoneSuffix[2]);
    if (display_name && phone_e164) {
      return { display_name, join_method: 'manual_phone', phone_e164 };
    }
  }

  const phoneOnly = toE164FromPhoneInput(trimmed);
  if (phoneOnly) {
    return { display_name: trimmed, join_method: 'manual_phone', phone_e164: phoneOnly };
  }

  if (trimmed.length > 60) return null;
  return { display_name: trimmed, join_method: 'manual_name_only' };
}

export function parsePastedMembers(text: string): GroupBuilderSubmitPayload[] {
  return text
    .split(/[\n,;]+/)
    .map((segment) => parseSingleMemberLine(segment))
    .filter((entry): entry is GroupBuilderSubmitPayload => entry !== null);
}

export function payloadToEntry(
  payload: GroupBuilderSubmitPayload,
  source: GroupBuilderEntry['source'],
): GroupBuilderEntry {
  return {
    ...payload,
    key: entryKeyForPayload(payload),
    source,
  };
}

export function mergeEntries(
  current: GroupBuilderEntry[],
  incoming: GroupBuilderEntry[],
): GroupBuilderEntry[] {
  const map = new Map(current.map((entry) => [entry.key, entry]));
  for (const entry of incoming) {
    map.set(entry.key, entry);
  }
  return Array.from(map.values());
}

export function filterOutExistingMembers(
  entries: GroupBuilderEntry[],
  existingNames: string[],
): GroupBuilderEntry[] {
  const existing = new Set(existingNames.map((name) => name.trim().toLowerCase()));
  return entries.filter((entry) => !existing.has(entry.display_name.trim().toLowerCase()));
}

export function collectSubmitPayloads(
  staging: GroupBuilderEntry[],
  manualRows: ManualInputRow[],
): GroupBuilderSubmitPayload[] {
  const fromManual = manualRows
    .map((row) => manualRowToPayload(row.name, row.phone))
    .filter((payload): payload is GroupBuilderSubmitPayload => payload !== null)
    .map((payload) => payloadToEntry(payload, 'manual'));

  const merged = mergeEntries(staging, fromManual);
  return merged.map(({ display_name, join_method, phone_e164 }) => ({
    display_name,
    join_method,
    phone_e164,
  }));
}

export function countReadyToSubmit(staging: GroupBuilderEntry[], manualRows: ManualInputRow[]): number {
  const valid = collectSubmitPayloads(staging, manualRows).length;
  const invalidPhoneRows = manualRows.filter((row) => manualRowHasInvalidPhone(row.name, row.phone)).length;
  return valid + invalidPhoneRows;
}

export function removeEntryKeys(entries: GroupBuilderEntry[], keys: Set<string>): GroupBuilderEntry[] {
  return entries.filter((entry) => !keys.has(entry.key));
}

export function contactMatchesQuery(contact: Contacts.Contact, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;

  const name = contactDisplayName(contact).toLowerCase();
  const phone = contact.phoneNumbers?.[0]?.number?.toLowerCase() ?? '';
  return name.includes(normalized) || phone.includes(normalized);
}
