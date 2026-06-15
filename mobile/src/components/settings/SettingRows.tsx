import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { authColors } from '../../theme/colors';

export function SettingSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

export function SettingRow({
  label,
  subtitle,
  onPress,
  destructive,
  showChevron,
  right,
}: {
  label: string;
  subtitle?: string;
  onPress?: () => void;
  destructive?: boolean;
  showChevron?: boolean;
  right?: React.ReactNode;
}) {
  const content = (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, destructive && styles.destructiveLabel]}>{label}</Text>
        {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
      </View>
      {right ?? (showChevron ? <Text style={styles.chevron}>›</Text> : null)}
    </View>
  );

  if (onPress) {
    return (
      <Pressable accessibilityRole="button" onPress={onPress}>
        {content}
      </Pressable>
    );
  }

  return content;
}

export function SettingToggle({
  label,
  subtitle,
  value,
  onValueChange,
  disabled,
}: {
  label: string;
  subtitle?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#1A8F9E' }}
        thumbColor="#FFFFFF"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: authColors.textOnDarkFaint,
    textTransform: 'uppercase',
    letterSpacing: 0.9,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: authColors.glassBorder,
    backgroundColor: authColors.glass,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  rowText: {
    flex: 1,
    paddingRight: 12,
  },
  rowLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: authColors.textOnDark,
  },
  destructiveLabel: {
    color: '#F87171',
  },
  rowSubtitle: {
    marginTop: 4,
    fontSize: 12,
    color: authColors.textOnDarkMuted,
    lineHeight: 17,
  },
  chevron: {
    fontSize: 22,
    color: authColors.textOnDarkMuted,
    lineHeight: 22,
  },
});
