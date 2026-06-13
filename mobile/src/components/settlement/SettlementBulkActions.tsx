import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { authColors } from '../../theme/colors';

interface BulkAction {
  id: string;
  label: string;
  onPress: () => void;
}

interface SettlementBulkActionsProps {
  actions: BulkAction[];
  loadingId?: string | null;
}

export function SettlementBulkActions({ actions, loadingId }: SettlementBulkActionsProps) {
  if (actions.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {actions.map((action) => (
          <Pressable
            key={action.id}
            accessibilityRole="button"
            accessibilityLabel={action.label}
            disabled={loadingId !== null && loadingId !== undefined}
            onPress={action.onPress}
            style={({ pressed }) => [
              styles.button,
              pressed && !loadingId && styles.buttonPressed,
            ]}
          >
            {loadingId === action.id ? (
              <ActivityIndicator size="small" color={authColors.textOnDark} />
            ) : (
              <Text style={styles.buttonText}>{action.label}</Text>
            )}
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 16,
    marginBottom: 8,
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  button: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(99, 102, 241, 0.28)',
    borderWidth: 1,
    borderColor: 'rgba(129, 140, 248, 0.45)',
    minWidth: 120,
    alignItems: 'center',
  },
  buttonPressed: {
    opacity: 0.88,
  },
  buttonText: {
    color: authColors.textOnDark,
    fontSize: 14,
    fontWeight: '700',
  },
});
