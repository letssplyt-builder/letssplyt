import { describe, expect, it } from '@jest/globals';
import {
  collectSubmitPayloads,
  contactMatchesQuery,
  contactToPayload,
  countReadyToSubmit,
  entryKeyForPayload,
  filterOutExistingMembers,
  manualRowHasInvalidPhone,
  manualRowToPayload,
  mergeEntries,
  parsePastedMembers,
  parseSingleMemberLine,
  payloadToEntry,
  removeEntryKeys,
} from '../../../components/events/groupBuilder.utils';

describe('groupBuilder.utils', () => {
  it('parses name-only lines from paste', () => {
    expect(parsePastedMembers('Alex\nJordan, Sam')).toEqual([
      { display_name: 'Alex', join_method: 'manual_name_only' },
      { display_name: 'Jordan', join_method: 'manual_name_only' },
      { display_name: 'Sam', join_method: 'manual_name_only' },
    ]);
  });

  it('parses name and phone from paste', () => {
    expect(parseSingleMemberLine('Jordan Lee +1 202 555 0100')).toEqual({
      display_name: 'Jordan Lee',
      join_method: 'manual_phone',
      phone_e164: '+12025550100',
    });
  });

  it('manual row without phone becomes name-only', () => {
    expect(manualRowToPayload('Alex', '')).toEqual({
      display_name: 'Alex',
      join_method: 'manual_name_only',
    });
  });

  it('manual row with phone becomes manual_phone', () => {
    expect(manualRowToPayload('Alex', '2025550100')).toEqual({
      display_name: 'Alex',
      join_method: 'manual_phone',
      phone_e164: '+12025550100',
    });
  });

  it('manualRowHasInvalidPhone is true only when name and partial phone are invalid', () => {
    expect(manualRowHasInvalidPhone('Alex', '')).toBe(false);
    expect(manualRowHasInvalidPhone('', '2025550100')).toBe(false);
    expect(manualRowHasInvalidPhone('Alex', '2025550100')).toBe(false);
    expect(manualRowHasInvalidPhone('Alex', '123')).toBe(true);
  });

  it('countReadyToSubmit includes manual rows with invalid phone so Done can surface validation', () => {
    expect(
      countReadyToSubmit([], [{ id: 'r1', name: 'Alex', phone: '123' }]),
    ).toBe(1);
  });

  it('countReadyToSubmit ignores blank manual rows', () => {
    expect(
      countReadyToSubmit(
        [],
        [
          { id: 'r1', name: '', phone: '' },
          { id: 'r2', name: 'Sam', phone: '' },
        ],
      ),
    ).toBe(1);
    expect(
      countReadyToSubmit(
        [payloadToEntry({ display_name: 'Jordan', join_method: 'manual_name_only' }, 'contact')],
        [{ id: 'r1', name: '', phone: '' }],
      ),
    ).toBe(1);
  });

  it('contactMatchesQuery matches name or phone substring', () => {
    const contact = {
      firstName: 'Jordan',
      lastName: 'Lee',
      phoneNumbers: [{ number: '+1 202 555 0100' }],
    } as never;

    expect(contactMatchesQuery(contact, '')).toBe(true);
    expect(contactMatchesQuery(contact, 'jord')).toBe(true);
    expect(contactMatchesQuery(contact, '555')).toBe(true);
    expect(contactMatchesQuery(contact, 'zzz')).toBe(false);
  });

  it('removeEntryKeys drops selected staging entries', () => {
    const first = payloadToEntry({ display_name: 'Alex', join_method: 'manual_name_only' }, 'manual');
    const second = payloadToEntry({ display_name: 'Sam', join_method: 'manual_name_only' }, 'manual');
    const remaining = removeEntryKeys([first, second], new Set([first.key]));
    expect(remaining).toHaveLength(1);
    expect(remaining[0].display_name).toBe('Sam');
  });

  it('dedupes staging entries by phone key', () => {
    const first = payloadToEntry(
      { display_name: 'Alex', join_method: 'manual_phone', phone_e164: '+12025550100' },
      'contact',
    );
    const second = payloadToEntry(
      { display_name: 'Alex R.', join_method: 'manual_phone', phone_e164: '+12025550100' },
      'manual',
    );
    const merged = mergeEntries([first], [second]);
    expect(merged).toHaveLength(1);
    expect(merged[0].source).toBe('manual');
  });

  it('collectSubmitPayloads merges staging and manual rows', () => {
    const staging = [
      payloadToEntry(
        { display_name: 'Jordan', join_method: 'manual_phone', phone_e164: '+12025550101' },
        'contact',
      ),
    ];
    const payloads = collectSubmitPayloads(staging, [
      { id: 'r1', name: 'Sam', phone: '' },
    ]);
    expect(payloads).toHaveLength(2);
    expect(payloads.map((p) => p.display_name).sort()).toEqual(['Jordan', 'Sam']);
  });

  it('filters out names already on the event', () => {
    const entries = [
      payloadToEntry({ display_name: 'Alex', join_method: 'manual_name_only' }, 'paste'),
      payloadToEntry({ display_name: 'Jordan', join_method: 'manual_name_only' }, 'paste'),
    ];
    const filtered = filterOutExistingMembers(entries, ['Alex']);
    expect(filtered.map((e) => e.display_name)).toEqual(['Jordan']);
  });

  it('maps expo contact to payload', () => {
    const payload = contactToPayload({
      id: 'c1',
      firstName: 'Jordan',
      lastName: 'Lee',
      phoneNumbers: [{ number: '+1 202 555 0100' }],
    } as never);
    expect(payload).toEqual({
      display_name: 'Jordan Lee',
      join_method: 'manual_phone',
      phone_e164: '+12025550100',
    });
    expect(entryKeyForPayload(payload!)).toBe('phone:+12025550100');
  });
});
