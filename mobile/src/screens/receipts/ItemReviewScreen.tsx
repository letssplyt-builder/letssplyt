import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { EventsStackParamList } from '../../navigation/types';
import { colors } from '../../theme/colors';

type Props = NativeStackScreenProps<EventsStackParamList, 'ItemReview'>;

/** Placeholder shell — full editor ships in E07-S03. */
export function ItemReviewScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { eventId, parseResult } = route.params;
  const itemCount = parseResult?.items.length ?? 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      <Pressable onPress={() => navigation.goBack()}>
        <Text style={styles.back}>Back</Text>
      </Pressable>
      <Text style={styles.title}>Review items</Text>
      <Text style={styles.subtitle}>
        Receipt uploaded. {itemCount} items parsed — full review UI arrives in the next build
        story.
      </Text>
      <Pressable
        style={styles.cta}
        onPress={() => navigation.navigate('SplitEntry', { eventId })}
      >
        <Text style={styles.ctaText}>Continue to split →</Text>
      </Pressable>
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
    marginBottom: 24,
  },
  cta: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  ctaText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
});
