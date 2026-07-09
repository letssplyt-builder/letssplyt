import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSparkFeedbackStore } from '../../store/sparkFeedbackStore';
import { useTheme } from '../../theme/ThemeContext';
import type { Theme } from '../../theme/types';

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    wrap: {
      position: 'absolute',
      right: 52,
      top: '42%',
      zIndex: 39,
      maxWidth: 210,
      alignItems: 'flex-end',
    },
    bubble: {
      backgroundColor: 'rgba(255, 255, 255, 0.96)',
      borderRadius: theme.radiusSm,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderWidth: 1,
      borderColor: 'rgba(14, 92, 102, 0.12)',
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.14,
      shadowRadius: 10,
      elevation: 6,
    },
    title: {
      fontSize: 14,
      fontWeight: '800',
      color: theme.accentInk,
      marginBottom: 2,
      fontFamily: theme.fontBody,
    },
    body: {
      fontSize: 12,
      lineHeight: 17,
      color: '#4B5563',
      fontFamily: theme.fontBody,
    },
    tail: {
      width: 12,
      height: 12,
      backgroundColor: 'rgba(255, 255, 255, 0.96)',
      borderRightWidth: 1,
      borderBottomWidth: 1,
      borderColor: 'rgba(14, 92, 102, 0.12)',
      transform: [{ rotate: '-45deg' }],
      marginTop: -7,
      marginRight: 8,
    },
  });
}

export function SparkFirstVisitHint() {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const showFirstVisitHint = useSparkFeedbackStore((state) => state.showFirstVisitHint);
  const dismissFirstVisitHint = useSparkFeedbackStore((state) => state.dismissFirstVisitHint);
  const ribbonHiddenForSession = useSparkFeedbackStore((state) => state.ribbonHiddenForSession);

  if (!showFirstVisitHint || ribbonHiddenForSession) {
    return null;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Dismiss feedback hint"
      onPress={dismissFirstVisitHint}
      style={styles.wrap}
    >
      <View style={styles.bubble}>
        <Text style={styles.title}>Got a thought?</Text>
        <Text style={styles.body}>Tap the spark — takes about 10 seconds.</Text>
      </View>
      <View style={styles.tail} />
    </Pressable>
  );
}
