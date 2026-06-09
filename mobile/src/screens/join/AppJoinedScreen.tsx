import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StyleSheet, Text, View } from 'react-native';
import { AuthGradientLayout } from '../../components/auth/AuthGradientLayout';
import { FadeSlideIn } from '../../components/auth/FadeSlideIn';
import { PrimaryButton } from '../../components/PrimaryButton';
import type { RootStackParamList } from '../../navigation/types';
import { authColors } from '../../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'AppJoined'>;

export function AppJoinedScreen({ navigation, route }: Props) {
  const { eventId, eventName } = route.params;

  const handleViewEvent = () => {
    if (!eventId) {
      navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
      return;
    }

    navigation.reset({
      index: 0,
      routes: [
        {
          name: 'MainTabs',
          state: {
            routes: [
              {
                name: 'EventsTab',
                state: {
                  routes: [{ name: 'EventDetail', params: { eventId } }],
                },
              },
            ],
          },
        },
      ],
    });
  };

  return (
    <AuthGradientLayout
      contentStyle={styles.content}
      footer={
        <FadeSlideIn delay={160}>
          <PrimaryButton
            label="View event →"
            onPress={handleViewEvent}
            accessibilityLabel={`View ${eventName}`}
          />
        </FadeSlideIn>
      }
    >
      <FadeSlideIn>
        <Text style={styles.emoji}>🎉</Text>
        <Text style={styles.title}>You&apos;re in!</Text>
        <Text style={styles.subtitle}>{eventName}</Text>
        <Text style={styles.body}>
          Your share will appear once the bill is split. You can check the event any time from
          Events.
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
  emoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  title: {
    color: authColors.textOnDark,
    fontSize: 32,
    fontWeight: '800',
    marginBottom: 8,
  },
  subtitle: {
    color: authColors.textOnDark,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
  },
  body: {
    color: authColors.textOnDarkMuted,
    fontSize: 15,
    lineHeight: 22,
  },
});
