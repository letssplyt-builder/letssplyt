import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { ShimmerBone, ShimmerScope } from '../feedback/Shimmer';
import { SCREEN_HORIZONTAL_PADDING } from '../../constants/layout';
import { useTheme } from '../../theme/ThemeContext';
import type { Theme } from '../../theme/types';

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    root: {
      paddingHorizontal: SCREEN_HORIZONTAL_PADDING,
      paddingTop: 12,
    },
    title: {
      width: '62%',
      height: 22,
      marginBottom: 18,
      borderRadius: theme.radiusSm,
    },
    hero: {
      alignSelf: 'center',
      width: 176,
      height: 176,
      borderRadius: theme.radius,
      marginBottom: 18,
    },
    actionRow: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 22,
    },
    action: {
      flex: 1,
      height: 48,
      borderRadius: theme.radiusSm,
    },
    section: {
      width: 108,
      height: 12,
      marginBottom: 12,
    },
    memberRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 8,
      paddingHorizontal: 10,
      backgroundColor: theme.surface,
      borderRadius: theme.radiusSm,
      borderWidth: 1,
      borderColor: theme.line,
      marginBottom: 6,
      minHeight: 48,
    },
    avatar: {
      width: 32,
      height: 32,
      borderRadius: 16,
    },
    memberCopy: {
      flex: 1,
      gap: 6,
    },
    name: {
      width: '58%',
      height: 12,
    },
    chip: {
      width: 54,
      height: 10,
      borderRadius: 100,
    },
  });
}

export function EventDetailSkeleton() {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <ShimmerScope>
      <View
        style={styles.root}
        accessibilityRole="progressbar"
        accessibilityLabel="Loading event"
      >
        <ShimmerBone style={styles.title} />
        <ShimmerBone style={styles.hero} />
        <View style={styles.actionRow}>
          <ShimmerBone style={styles.action} />
          <ShimmerBone style={styles.action} />
        </View>
        <ShimmerBone style={styles.section} />
        {[0, 1, 2, 3].map((index) => (
          <View key={index} style={styles.memberRow}>
            <ShimmerBone style={styles.avatar} />
            <View style={styles.memberCopy}>
              <ShimmerBone style={styles.name} />
              <ShimmerBone style={styles.chip} />
            </View>
          </View>
        ))}
      </View>
    </ShimmerScope>
  );
}
