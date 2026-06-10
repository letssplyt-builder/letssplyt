import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StyleSheet, Text } from 'react-native';
import { AuthGradientLayout } from '../../components/auth/AuthGradientLayout';
import { FadeSlideIn } from '../../components/auth/FadeSlideIn';
import { PrimaryButton } from '../../components/PrimaryButton';
import type { RootStackParamList } from '../../navigation/types';
import { authColors } from '../../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'AppLocked'>;

export function AppLockedScreen({ navigation, route }: Props) {
  const { creatorName, eventName } = route.params;

  return (
    <AuthGradientLayout
      bottomSafeArea="system"
      contentStyle={styles.content}
      footer={
        <FadeSlideIn delay={160}>
          <PrimaryButton
            label="Go home →"
            onPress={() => navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] })}
            accessibilityLabel="Go to home"
          />
        </FadeSlideIn>
      }
    >
      <FadeSlideIn>
        <Text style={styles.title}>Group is locked</Text>
        {eventName ? <Text style={styles.eventName}>{eventName}</Text> : null}
        <Text style={styles.body}>
          {creatorName
            ? `Ask ${creatorName} to reopen the join window if you'd like to be added.`
            : 'Ask the organiser to reopen the join window if you would like to be added.'}
        </Text>
      </FadeSlideIn>
    </AuthGradientLayout>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  title: {
    color: authColors.textOnDark,
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 8,
  },
  eventName: {
    color: authColors.textOnDark,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  body: {
    color: authColors.textOnDarkMuted,
    fontSize: 15,
    lineHeight: 22,
  },
});
