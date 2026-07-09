import { useMemo } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useAppInsets } from '../../hooks/useAppInsets';
import { useTheme } from '../../theme/ThemeContext';

interface EventFabProps {
  onPress: () => void;
}

export function EventFab({ onPress }: EventFabProps) {
  const { theme } = useTheme();
  const { fabBottomOffset } = useAppInsets();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Create a new event"
      onPress={onPress}
      style={({ pressed }) => [
        styles.fab,
        { bottom: fabBottomOffset },
        pressed && styles.fabPressed,
      ]}
    >
      <Text style={styles.label}>＋ New event</Text>
    </Pressable>
  );
}

function makeStyles(theme: ReturnType<typeof useTheme>['theme']) {
  return StyleSheet.create({
    fab: {
      position: 'absolute',
      right: 20,
      backgroundColor: theme.accent,
      paddingHorizontal: 18,
      paddingVertical: 14,
      borderRadius: 28,
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.22,
      shadowRadius: 12,
      elevation: 8,
      zIndex: 10,
    },
    fabPressed: {
      opacity: 0.92,
      transform: [{ scale: 0.98 }],
    },
    label: {
      color: theme.accentInk,
      fontSize: 14,
      fontWeight: '700',
      fontFamily: theme.fontBody,
    },
  });
}
