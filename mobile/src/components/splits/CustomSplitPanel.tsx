import { StyleSheet, Text, TextInput, View } from 'react-native';
import { SplitModeTabs } from './SplitModeTabs';
import { colors } from '../../theme/colors';
import {
  avatarColorFromName,
  formatSplitMoney,
  parseNumericInput,
  type SplitEntryTab,
} from '../../screens/splits/splitEntry.utils';

interface ParticipantRow {
  id: string;
  display_name: string;
}

interface CustomSplitPanelProps {
  participants: ParticipantRow[];
  currency: string;
  activeTab: SplitEntryTab;
  onTabChange: (tab: SplitEntryTab) => void;
  evenAmounts: number[];
  amountInputs: Record<string, string>;
  onAmountChange: (id: string, text: string) => void;
  percentInputs: Record<string, string>;
  onPercentChange: (id: string, text: string) => void;
  percentAmounts: number[];
  portionInputs: Record<string, string>;
  onPortionChange: (id: string, text: string) => void;
  allocationLabel: string;
  allocationBalanced: boolean;
  progressRatio: number;
  manualTotalInput?: string;
  onManualTotalChange?: (text: string) => void;
  showManualTotal?: boolean;
}

export function CustomSplitPanel({
  participants,
  currency,
  activeTab,
  onTabChange,
  evenAmounts,
  amountInputs,
  onAmountChange,
  percentInputs,
  onPercentChange,
  percentAmounts,
  portionInputs,
  onPortionChange,
  allocationLabel,
  allocationBalanced,
  progressRatio,
  manualTotalInput,
  onManualTotalChange,
  showManualTotal,
}: CustomSplitPanelProps) {
  const clampedProgress = Math.min(1, Math.max(0, progressRatio));

  return (
    <View style={styles.panel}>
      {showManualTotal ? (
        <View style={styles.manualBlock}>
          <Text style={styles.manualLabel}>What was the total?</Text>
          <TextInput
            accessibilityLabel="Bill total amount"
            keyboardType="decimal-pad"
            value={manualTotalInput ?? ''}
            onChangeText={onManualTotalChange}
            style={styles.manualInput}
            placeholder="0.00"
            placeholderTextColor={colors.textFaint}
          />
        </View>
      ) : null}

      <SplitModeTabs value={activeTab} onChange={onTabChange} />

      <View style={styles.progressBlock}>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              allocationBalanced ? styles.progressFillOk : styles.progressFillWarn,
              { width: `${clampedProgress * 100}%` },
            ]}
          />
        </View>
        <Text
          style={[
            styles.progressLabel,
            allocationBalanced ? styles.progressLabelOk : styles.progressLabelWarn,
          ]}
          accessibilityLiveRegion="polite"
        >
          {allocationLabel}
        </Text>
      </View>

      <View style={styles.card}>
        {participants.map((participant, index) => {
          let displayAmount = 0;
          if (activeTab === 'even') displayAmount = evenAmounts[index] ?? 0;
          if (activeTab === 'amount')
            displayAmount = parseNumericInput(amountInputs[participant.id] ?? '');
          if (activeTab === 'percent') displayAmount = percentAmounts[index] ?? 0;

          const color = avatarColorFromName(participant.display_name);

          return (
            <View key={participant.id} style={styles.row}>
              <View style={[styles.avatar, { backgroundColor: color }]}>
                <Text style={styles.avatarText}>
                  {participant.display_name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <Text style={styles.name} numberOfLines={1}>{participant.display_name}</Text>

              {activeTab === 'even' ? (
                <Text style={styles.amountPill}>{formatSplitMoney(displayAmount, currency)}</Text>
              ) : null}
              {activeTab === 'amount' ? (
                <TextInput
                  accessibilityLabel={`Amount for ${participant.display_name}`}
                  keyboardType="decimal-pad"
                  value={amountInputs[participant.id] ?? ''}
                  onChangeText={(text) => onAmountChange(participant.id, text)}
                  style={styles.input}
                  placeholder="0"
                  placeholderTextColor={colors.textFaint}
                />
              ) : null}
              {activeTab === 'percent' ? (
                <View style={styles.percentWrap}>
                  <TextInput
                    accessibilityLabel={`Percentage for ${participant.display_name}`}
                    keyboardType="decimal-pad"
                    value={percentInputs[participant.id] ?? ''}
                    onChangeText={(text) => onPercentChange(participant.id, text)}
                    style={styles.inputSmall}
                    placeholder="0"
                  />
                  <Text style={styles.percentSuffix}>
                    {formatSplitMoney(percentAmounts[index] ?? 0, currency)}
                  </Text>
                </View>
              ) : null}
              {activeTab === 'portion' ? (
                <TextInput
                  accessibilityLabel={`Portions for ${participant.display_name}`}
                  keyboardType="number-pad"
                  value={portionInputs[participant.id] ?? '1'}
                  onChangeText={(text) => onPortionChange(participant.id, text)}
                  style={styles.inputSmall}
                />
              ) : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    gap: 4,
  },
  manualBlock: {
    marginBottom: 14,
    padding: 16,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
  },
  manualLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
    marginBottom: 8,
  },
  manualInput: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.5,
  },
  progressBlock: {
    marginBottom: 14,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.25)',
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressFillOk: {
    backgroundColor: '#34D399',
  },
  progressFillWarn: {
    backgroundColor: '#FBBF24',
  },
  progressLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  progressLabelOk: {
    color: '#A7F3D0',
  },
  progressLabelWarn: {
    color: '#FDE68A',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
    shadowColor: '#0B3D45',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 16,
  },
  name: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  amountPill: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.primary,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  input: {
    minWidth: 88,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'right',
    color: colors.text,
    backgroundColor: colors.surfaceMuted,
  },
  percentWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inputSmall: {
    width: 56,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 8,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    color: colors.text,
    backgroundColor: colors.surfaceMuted,
  },
  percentSuffix: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
    minWidth: 64,
    textAlign: 'right',
  },
});
