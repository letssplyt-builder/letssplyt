import { useMemo } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StyleSheet, Text } from 'react-native';
import { AuthGradientLayout } from '../../components/auth/AuthGradientLayout';
import { FadeSlideIn } from '../../components/auth/FadeSlideIn';
import { PrimaryButton } from '../../components/PrimaryButton';
import type { RootStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme/ThemeContext';
import type { Theme } from '../../theme/types';

type Props = NativeStackScreenProps<RootStackParamList, 'AppJoined'>;

function makeStyles(theme: Theme) {
  return StyleSheet.create({
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
      color: theme.ink,
      fontSize: 32,
      fontWeight: '800',
      marginBottom: 8,
      fontFamily: theme.fontDisplay,
    },
    subtitle: {
      color: theme.ink,
      fontSize: 20,
      fontWeight: '700',
      marginBottom: 12,
      fontFamily: theme.fontBody,
    },
    body: {
      color: theme.ink2,
      fontSize: 15,
      lineHeight: 22,
      fontFamily: theme.fontBody,
    },
  });
}

export function AppJoinedScreen({ navigation, route }: Props) {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
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
      bottomSafeArea="system"
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
