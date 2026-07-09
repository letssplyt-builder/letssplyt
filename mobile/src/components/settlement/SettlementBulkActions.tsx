import { useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import type { Theme } from '../../theme/types';

interface BulkAction {
  id: string;
  label: string;
  onPress: () => void;
}

interface SettlementBulkActionsProps {
  actions: BulkAction[];
  loadingId?: string | null;
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
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
      borderRadius: theme.radiusSm,
      backgroundColor: theme.accentSoft,
      borderWidth: 1,
      borderColor: theme.accent,
      minWidth: 120,
      alignItems: 'center',
    },
    buttonPressed: {
      opacity: 0.88,
    },
    buttonText: {
      color: theme.ink,
      fontSize: 14,
      fontWeight: '700',
      fontFamily: theme.fontBody,
    },
  });
}

export function SettlementBulkActions({ actions, loadingId }: SettlementBulkActionsProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

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
              <ActivityIndicator size="small" color={theme.ink} />
            ) : (
              <Text style={styles.buttonText}>{action.label}</Text>
            )}
          </Pressable>
        ))}
      </View>
    </View>
  );
}
