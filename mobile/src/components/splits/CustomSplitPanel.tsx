import { useMemo } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { SplitModeTabs } from './SplitModeTabs';
import {
  avatarColorFromName,
  formatSplitMoney,
  parseNumericInput,
  type SplitEntryTab,
} from '../../screens/splits/splitEntry.utils';
import { useTheme } from '../../theme/ThemeContext';
import type { Theme } from '../../theme/types';

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
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    panel: {
      gap: 2,
    },
    progressBlock: {
      marginBottom: 10,
    },
    progressTrack: {
      height: 4,
      borderRadius: 2,
      backgroundColor: theme.line,
      overflow: 'hidden',
      marginBottom: 6,
    },
    progressFill: {
      height: '100%',
      borderRadius: 3,
    },
    progressFillOk: {
      backgroundColor: theme.good,
    },
    progressFillWarn: {
      backgroundColor: theme.warn,
    },
    progressLabel: {
      fontSize: 12,
      fontWeight: '600',
      fontFamily: theme.fontBody,
    },
    progressLabelOk: {
      color: theme.good,
    },
    progressLabelWarn: {
      color: theme.warn,
    },
    card: {
      backgroundColor: theme.surfaceStrong,
      borderRadius: theme.radiusSm,
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderWidth: 1,
      borderColor: theme.line,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.line,
      gap: 10,
    },
    avatar: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: {
      color: theme.ink,
      fontWeight: '800',
      fontSize: 13,
    },
    name: {
      flex: 1,
      fontSize: 15,
      fontWeight: '600',
      color: theme.ink,
      fontFamily: theme.fontBody,
    },
    amountPill: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.accent,
      backgroundColor: theme.accentSoft,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: theme.radiusSm,
      fontFamily: theme.fontDisplay,
    },
    input: {
      minWidth: 76,
      minHeight: 36,
      borderWidth: 1,
      borderColor: theme.line,
      borderRadius: theme.radiusSm,
      paddingHorizontal: 10,
      paddingVertical: 6,
      fontSize: 15,
      fontWeight: '700',
      textAlign: 'right',
      color: theme.ink,
      backgroundColor: theme.surface,
      fontFamily: theme.fontBody,
    },
    percentWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    inputSmall: {
      width: 48,
      minHeight: 36,
      borderWidth: 1,
      borderColor: theme.line,
      borderRadius: theme.radiusSm,
      paddingHorizontal: 6,
      paddingVertical: 6,
      fontSize: 15,
      fontWeight: '700',
      textAlign: 'center',
      color: theme.ink,
      backgroundColor: theme.surface,
      fontFamily: theme.fontBody,
    },
    percentSuffix: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.ink3,
      minWidth: 56,
      textAlign: 'right',
      fontFamily: theme.fontBody,
    },
  });
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
}: CustomSplitPanelProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const clampedProgress = Math.min(1, Math.max(0, progressRatio));

  return (
    <View style={styles.panel}>
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
                  placeholderTextColor={theme.ink3}
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
                    placeholderTextColor={theme.ink3}
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
                  placeholderTextColor={theme.ink3}
                />
              ) : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}
