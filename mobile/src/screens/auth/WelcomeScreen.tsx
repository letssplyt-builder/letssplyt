import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PrimaryButton } from '../../components/PrimaryButton';
import type { RootStackParamList } from '../../navigation/types';
import { colors } from '../../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'Welcome'>;

const VALUE_PROPS = [
  { icon: '📸', text: 'Scan any receipt instantly' },
  { icon: '💸', text: 'Everyone pays their exact share' },
  { icon: '🔗', text: 'Guests pay without the app' },
] as const;

export function WelcomeScreen({ navigation }: Props) {
  return (
    <View style={styles.gradient}>
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.hero}>
            <View style={styles.logoGem}>
              <Text style={styles.logoIcon}>✦</Text>
            </View>
            <Text style={styles.wordmark}>LetsSplyt</Text>
            <Text style={styles.tagline}>Split bills. No chasing. No drama.</Text>
          </View>

          <View style={styles.valueProps}>
            {VALUE_PROPS.map((item) => (
              <View key={item.text} style={styles.valueRow} accessibilityRole="text">
                <Text style={styles.valueIcon}>{item.icon}</Text>
                <Text style={styles.valueText}>{item.text}</Text>
              </View>
            ))}
          </View>

          <View style={styles.actions}>
            <PrimaryButton
              accessibilityLabel="Get started with LetsSplyt"
              label="Get Started →"
              onPress={() => navigation.navigate('PhoneEntry', { mode: 'register' })}
            />
            <Pressable
              accessibilityRole="button"
              onPress={() => navigation.navigate('PhoneEntry', { mode: 'login' })}
              style={styles.secondaryLink}
            >
              <Text style={styles.secondaryText}>I already have an account</Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1, backgroundColor: colors.background },
  safe: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 32,
    justifyContent: 'space-between',
  },
  hero: {
    alignItems: 'center',
    paddingTop: 48,
    marginBottom: 32,
  },
  logoGem: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 6,
  },
  logoIcon: {
    fontSize: 32,
    color: '#FFFFFF',
  },
  wordmark: {
    fontSize: 34,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.5,
  },
  tagline: {
    marginTop: 8,
    fontSize: 15,
    color: colors.textMuted,
    textAlign: 'center',
  },
  valueProps: {
    gap: 14,
    marginBottom: 40,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderLight,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  valueIcon: { fontSize: 20 },
  valueText: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
    fontWeight: '500',
  },
  actions: {
    gap: 12,
  },
  secondaryLink: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  secondaryText: {
    fontSize: 14,
    color: colors.textMuted,
    fontWeight: '500',
  },
});
