import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StyleSheet, Text, View } from 'react-native';
import { AuthGradientLayout } from '../../components/auth/AuthGradientLayout';
import { FadeSlideIn } from '../../components/auth/FadeSlideIn';
import { PrimaryButton } from '../../components/PrimaryButton';
import type { RootStackParamList } from '../../navigation/types';
import { authColors } from '../../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'Welcome'>;

export function WelcomeScreen({ navigation }: Props) {
  return (
    <AuthGradientLayout
      bottomSafeArea="system"
      contentStyle={styles.content}
      footer={
        <FadeSlideIn delay={280}>
          <PrimaryButton
            accessibilityLabel="Get started with LetsSplyt"
            label="Get Started"
            variant="inverse"
            onPress={() => navigation.navigate('PhoneEntry', {})}
          />
        </FadeSlideIn>
      }
    >
      <View style={styles.hero}>
        <FadeSlideIn delay={0}>
          <Text style={styles.logoMark}>✦</Text>
        </FadeSlideIn>
        <FadeSlideIn delay={90}>
          <Text style={styles.wordmark}>LetsSplyt</Text>
        </FadeSlideIn>
        <View style={styles.taglineWrap}>
          <Text style={styles.tagline}>Split Bills, Not Friendships</Text>
        </View>
      </View>
    </AuthGradientLayout>
  );
}

const styles = StyleSheet.create({
  content: {
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  hero: {
    width: '100%',
    alignItems: 'center',
    paddingBottom: 48,
  },
  taglineWrap: {
    width: '100%',
    alignSelf: 'stretch',
  },
  logoMark: {
    fontSize: 44,
    color: authColors.textOnDark,
    marginBottom: 20,
    fontWeight: '300',
  },
  wordmark: {
    fontSize: 38,
    fontWeight: '800',
    color: authColors.textOnDark,
    letterSpacing: -0.8,
    marginBottom: 10,
  },
  tagline: {
    width: '100%',
    fontSize: 16,
    color: authColors.textOnDarkMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
});
