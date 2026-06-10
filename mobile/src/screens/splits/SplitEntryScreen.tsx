import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { EventsStackParamList } from '../../navigation/types';
import { colors } from '../../theme/colors';

type Props = NativeStackScreenProps<EventsStackParamList, 'SplitEntry'>;

/** Placeholder shell — full split tabs ship in E07-S06. */
export function SplitEntryScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { eventId, mode = 'itemised' } = route.params;

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      <Pressable onPress={() => navigation.goBack()}>
        <Text style={styles.back}>Back</Text>
      </Pressable>
      <Text style={styles.title}>Split entry</Text>
      <Text style={styles.subtitle}>
        {mode === 'manual'
          ? 'Custom split — enter the bill total and allocate amounts (E07-S06).'
          : 'Itemised split — assign receipt items to members (E07-S06).'}
      </Text>
      <Text style={styles.meta}>Event: {eventId}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 20,
  },
  back: {
    color: colors.primary,
    fontWeight: '600',
    fontSize: 15,
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: colors.textMuted,
    lineHeight: 22,
    marginBottom: 12,
  },
  meta: {
    fontSize: 12,
    color: colors.textMuted,
    fontFamily: 'monospace',
  },
});
