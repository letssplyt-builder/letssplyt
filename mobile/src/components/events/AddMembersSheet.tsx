import * as Contacts from 'expo-contacts';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { BottomSheetModal } from '../layout/BottomSheetModal';
import { PrimaryButton } from '../PrimaryButton';
import { SegmentedControl } from './SegmentedControl';
import { authColors } from '../../theme/colors';
import {
  AUTH_COUNTRIES,
  DEFAULT_AUTH_REGION,
  handleUsNationalPhoneInput,
  US_NATIONAL_DISPLAY_MAX_LENGTH,
} from '../../utils/phone';
import {
  collectSubmitPayloads,
  contactDisplayName,
  contactMatchesQuery,
  contactToPayload,
  countReadyToSubmit,
  createManualRowId,
  manualRowHasInvalidPhone,
  mergeEntries,
  payloadToEntry,
  removeEntryKeys,
  type GroupBuilderEntry,
  type GroupBuilderSubmitPayload,
  type ManualInputRow,
} from './groupBuilder.utils';

const SHEET_MAX_HEIGHT = Dimensions.get('window').height * 0.88;
const CONTACT_LIST_HEIGHT = 280;
const DEFAULT_MANUAL_ROWS = 1;

type AddMembersTab = 'contacts' | 'names';

export type AddMembersBatchResult = {
  added: GroupBuilderSubmitPayload[];
  failed: Array<{ entry: GroupBuilderSubmitPayload; message: string }>;
};

interface AddMembersSheetProps {
  visible: boolean;
  isSubmitting: boolean;
  submitError: string | null;
  existingParticipants: Array<{ display_name: string }>;
  onClose: () => void;
  onSubmitBatch: (entries: GroupBuilderSubmitPayload[]) => Promise<AddMembersBatchResult>;
}

function createEmptyManualRows(count = DEFAULT_MANUAL_ROWS): ManualInputRow[] {
  return Array.from({ length: count }, () => ({
    id: createManualRowId(),
    name: '',
    phone: '',
  }));
}

export function AddMembersSheet({
  visible,
  isSubmitting,
  submitError,
  existingParticipants,
  onClose,
  onSubmitBatch,
}: AddMembersSheetProps) {
  const [tab, setTab] = useState<AddMembersTab>('contacts');
  const [searchQuery, setSearchQuery] = useState('');
  const [staging, setStaging] = useState<GroupBuilderEntry[]>([]);
  const [manualRows, setManualRows] = useState<ManualInputRow[]>(createEmptyManualRows);
  const [contacts, setContacts] = useState<Contacts.Contact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactsDenied, setContactsDenied] = useState(false);
  const [contactsError, setContactsError] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const existingNames = useMemo(
    () => existingParticipants.map((participant) => participant.display_name),
    [existingParticipants],
  );

  const resetState = useCallback(() => {
    setTab('contacts');
    setSearchQuery('');
    setStaging([]);
    setManualRows(createEmptyManualRows());
    setContactsDenied(false);
    setContactsError(null);
    setLocalError(null);
  }, []);

  const loadContacts = useCallback(async () => {
    setContactsLoading(true);
    setContactsDenied(false);
    setContactsError(null);

    const { status } = await Contacts.requestPermissionsAsync();
    if (status !== 'granted') {
      setContactsDenied(true);
      setContactsLoading(false);
      return;
    }

    try {
      const { data } = await Contacts.getContactsAsync({
        fields: [
          Contacts.Fields.PhoneNumbers,
          Contacts.Fields.Name,
          Contacts.Fields.FirstName,
          Contacts.Fields.LastName,
        ],
        sort: Contacts.SortTypes.FirstName,
      });

      const withPhone = (data ?? []).filter(
        (contact) => contact.phoneNumbers && contact.phoneNumbers.length > 0,
      );
      setContacts(withPhone);
    } catch {
      setContactsError('Could not load contacts.');
    } finally {
      setContactsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      resetState();
      void loadContacts();
    }
  }, [visible, resetState, loadContacts]);

  const filteredContacts = useMemo(
    () => contacts.filter((contact) => contactMatchesQuery(contact, searchQuery)),
    [contacts, searchQuery],
  );

  const stagingKeys = useMemo(() => new Set(staging.map((entry) => entry.key)), [staging]);
  const readyCount = countReadyToSubmit(staging, manualRows);
  const busy = isSubmitting;
  const errorMessage = localError ?? submitError;

  const toggleContact = (contact: Contacts.Contact) => {
    const payload = contactToPayload(contact);
    if (!payload) {
      setLocalError('Could not read that phone number.');
      return;
    }

    const entry = payloadToEntry(payload, 'contact');
    if (stagingKeys.has(entry.key)) {
      setStaging((prev) => removeEntryKeys(prev, new Set([entry.key])));
      return;
    }

    setStaging((prev) => mergeEntries(prev, [entry]));
    setLocalError(null);
  };

  const handleDone = async () => {
    setLocalError(null);

    const invalidManual = manualRows.find((row) => manualRowHasInvalidPhone(row.name, row.phone));
    if (invalidManual) {
      setLocalError(
        `Enter a valid phone for ${invalidManual.name.trim()} or leave phone blank.`,
      );
      return;
    }

    const payloads = collectSubmitPayloads(staging, manualRows);
    if (payloads.length === 0) {
      setLocalError('Select contacts or enter at least one name.');
      return;
    }

    const filtered = payloads.filter(
      (payload) =>
        !existingNames.some(
          (name) => name.trim().toLowerCase() === payload.display_name.trim().toLowerCase(),
        ),
    );

    if (filtered.length === 0) {
      setLocalError('Everyone selected is already on this event.');
      return;
    }

    const result = await onSubmitBatch(filtered);

    if (result.added.length > 0) {
      onClose();
      return;
    }

    if (result.failed.length > 0) {
      const names = result.failed.map((item) => item.entry.display_name).join(', ');
      setLocalError(`Could not add: ${names}`);
    }
  };

  const doneLabel =
    readyCount > 0
      ? `Done · add ${readyCount} ${readyCount === 1 ? 'member' : 'members'}`
      : 'Done';

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      keyboardAware={tab === 'names'}
      dismissLabel="Dismiss add members"
      sheetStyle={styles.sheetBg}
    >
      <View style={[styles.container, { maxHeight: SHEET_MAX_HEIGHT }]}>
        <View style={styles.handle} />
        <Text style={styles.heading}>Add members</Text>
        <Text style={styles.subheading}>
          Choose contacts or type names. Tap Done to add everyone at once.
        </Text>

        <SegmentedControl
          segments={['contacts', 'names'] as const}
          labels={{ contacts: 'Contacts', names: 'By name' }}
          value={tab}
          onChange={setTab}
        />

        {tab === 'contacts' ? (
          <View style={styles.tabPanel}>
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search contacts"
              placeholderTextColor={authColors.textOnDarkFaint}
              style={styles.field}
              editable={!busy}
              accessibilityLabel="Search contacts"
            />

            {contactsLoading ? (
              <ActivityIndicator color={authColors.textOnDark} style={styles.loader} />
            ) : contactsDenied ? (
              <View style={styles.noticeBox}>
                <Text style={styles.noticeText}>
                  Contacts access is off. Switch to By name or enable contacts in Settings.
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Open Settings"
                  onPress={() => void Linking.openSettings()}
                >
                  <Text style={styles.noticeLink}>Open Settings</Text>
                </Pressable>
              </View>
            ) : (
              <FlatList
                data={filteredContacts.slice(0, 50)}
                keyExtractor={(item, index) =>
                  (item as Contacts.Contact & { id?: string }).id ?? `contact-${index}`
                }
                style={styles.contactList}
                initialNumToRender={50}
                maxToRenderPerBatch={50}
                keyboardShouldPersistTaps="handled"
                ListEmptyComponent={
                  <Text style={styles.emptyContacts}>
                    {contactsError ?? 'No contacts with phone numbers found.'}
                  </Text>
                }
                renderItem={({ item }) => {
                  const payload = contactToPayload(item);
                  if (!payload) return null;
                  const key = payloadToEntry(payload, 'contact').key;
                  const selected = stagingKeys.has(key);

                  return (
                    <Pressable
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: selected }}
                      accessibilityLabel={`${contactDisplayName(item)}${selected ? ', selected' : ''}`}
                      onPress={() => toggleContact(item)}
                      disabled={busy}
                      style={[styles.contactRow, selected && styles.contactRowSelected]}
                    >
                      <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
                        {selected ? <Text style={styles.checkmark}>✓</Text> : null}
                      </View>
                      <View style={styles.contactTextWrap}>
                        <Text style={styles.contactName}>{contactDisplayName(item)}</Text>
                        <Text style={styles.contactPhone} numberOfLines={1}>
                          {item.phoneNumbers?.[0]?.number ?? ''}
                        </Text>
                      </View>
                    </Pressable>
                  );
                }}
              />
            )}
          </View>
        ) : (
          <ScrollView
            style={styles.namesScroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {manualRows.map((row, index) => (
              <View
                key={row.id}
                style={[styles.personBlock, index > 0 && styles.personBlockSpaced]}
              >
                <Text style={styles.personLabel}>Person {index + 1}</Text>
                <TextInput
                  value={row.name}
                  onChangeText={(text) =>
                    setManualRows((prev) =>
                      prev.map((item) => (item.id === row.id ? { ...item, name: text } : item)),
                    )
                  }
                  placeholder="Full name"
                  placeholderTextColor={authColors.textOnDarkFaint}
                  style={styles.field}
                  editable={!busy}
                  accessibilityLabel={`Person ${index + 1} name`}
                />
                <TextInput
                  value={row.phone}
                  onChangeText={(text) =>
                    setManualRows((prev) =>
                      prev.map((item) =>
                        item.id === row.id
                          ? { ...item, phone: handleUsNationalPhoneInput(text) }
                          : item,
                      ),
                    )
                  }
                  placeholder={`Phone (${AUTH_COUNTRIES[DEFAULT_AUTH_REGION].dial}) — optional`}
                  placeholderTextColor={authColors.textOnDarkFaint}
                  keyboardType="phone-pad"
                  maxLength={US_NATIONAL_DISPLAY_MAX_LENGTH}
                  style={styles.field}
                  editable={!busy}
                  accessibilityLabel={`Person ${index + 1} phone, optional`}
                />
              </View>
            ))}

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add another person"
              onPress={() =>
                setManualRows((prev) => [...prev, { id: createManualRowId(), name: '', phone: '' }])
              }
              disabled={busy}
              style={styles.addPersonLink}
            >
              <Text style={styles.addPersonLinkText}>+ Add another person</Text>
            </Pressable>
          </ScrollView>
        )}

        {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

        <PrimaryButton
          label={doneLabel}
          loading={isSubmitting}
          disabled={busy || readyCount === 0}
          onPress={() => void handleDone()}
          accessibilityLabel={doneLabel}
          style={styles.doneButton}
        />
      </View>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  sheetBg: {
    backgroundColor: authColors.gradientMid,
  },
  container: {
    width: '100%',
    gap: 14,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: authColors.glassBorder,
    alignSelf: 'center',
  },
  heading: {
    fontSize: 20,
    fontWeight: '800',
    color: authColors.textOnDark,
  },
  subheading: {
    fontSize: 13,
    color: authColors.textOnDarkMuted,
    lineHeight: 18,
  },
  tabPanel: {
    gap: 10,
    minHeight: CONTACT_LIST_HEIGHT + 52,
  },
  namesScroll: {
    maxHeight: CONTACT_LIST_HEIGHT + 80,
  },
  field: {
    borderWidth: 1.5,
    borderColor: authColors.glassBorder,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: authColors.textOnDark,
    backgroundColor: authColors.glassStrong,
    width: '100%',
  },
  loader: {
    marginVertical: 16,
  },
  noticeBox: {
    gap: 8,
    padding: 14,
    borderRadius: 14,
    backgroundColor: authColors.errorBgOnDark,
  },
  noticeText: {
    fontSize: 13,
    color: authColors.textOnDarkMuted,
    lineHeight: 18,
  },
  noticeLink: {
    fontSize: 14,
    fontWeight: '700',
    color: authColors.textOnDark,
    textDecorationLine: 'underline',
  },
  contactList: {
    height: CONTACT_LIST_HEIGHT,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: authColors.glassBorder,
    backgroundColor: authColors.glassStrong,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 56,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: authColors.glassBorder,
  },
  contactRowSelected: {
    backgroundColor: 'rgba(45, 212, 191, 0.12)',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: authColors.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: 'rgba(45, 212, 191, 0.35)',
    borderColor: 'rgba(45, 212, 191, 0.8)',
  },
  checkmark: {
    fontSize: 14,
    fontWeight: '800',
    color: authColors.textOnDark,
  },
  contactTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  contactName: {
    fontSize: 15,
    fontWeight: '600',
    color: authColors.textOnDark,
  },
  contactPhone: {
    fontSize: 13,
    color: authColors.textOnDarkMuted,
    marginTop: 2,
  },
  emptyContacts: {
    fontSize: 13,
    color: authColors.textOnDarkMuted,
    padding: 20,
    textAlign: 'center',
  },
  personBlock: {
    gap: 8,
    marginBottom: 4,
  },
  personBlockSpaced: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: authColors.glassBorder,
  },
  personLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: authColors.textOnDarkMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  addPersonLink: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
  },
  addPersonLinkText: {
    fontSize: 14,
    fontWeight: '700',
    color: authColors.textOnDarkMuted,
  },
  error: {
    fontSize: 13,
    color: authColors.errorOnDark,
    lineHeight: 18,
  },
  doneButton: {
    marginTop: 4,
  },
});
