import { useCallback, useEffect, useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { AuthGradientLayout } from '../../components/auth/AuthGradientLayout';
import { FadeSlideIn } from '../../components/auth/FadeSlideIn';
import { PrimaryButton } from '../../components/PrimaryButton';
import type { RootStackParamList } from '../../navigation/types';
import { getApiErrorCode, isApiRequestError } from '../../services/api';
import * as joinService from '../../services/join.service';
import { useAuthStore } from '../../store/authStore';
import { useJoinStore } from '../../store/joinStore';
import { authColors } from '../../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'AppJoin'>;

export function AppJoinScreen({ navigation, route }: Props) {
  const { token } = route.params;
  const user = useAuthStore((state) => state.user);
  const [eventName, setEventName] = useState<string | null>(null);
  const [creatorName, setCreatorName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    useJoinStore.getState().setPendingJoinToken(token);
  }, [token]);

  useEffect(() => {
    let cancelled = false;

    async function loadPreview() {
      setLoading(true);
      setError(null);
      try {
        const preview = await joinService.fetchJoinPreview(token);
        if (cancelled) return;

        if (!preview.joinable) {
          navigation.replace('AppLocked', {
            creatorName: preview.creatorName,
            eventName: preview.eventName,
          });
          return;
        }

        setEventName(preview.eventName);
        setCreatorName(preview.creatorName);
      } catch (err) {
        if (cancelled) return;
        if (isApiRequestError(err)) {
          setError(err.message);
        } else {
          setError('Could not load this event. Check the link and try again.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadPreview();
    return () => {
      cancelled = true;
    };
  }, [navigation, token]);

  const handleJoin = useCallback(async () => {
    setJoining(true);
    setError(null);
    try {
      const result = await joinService.appJoinEvent(token);
      useJoinStore.getState().clearPendingJoinToken();
      navigation.replace('AppJoined', {
        eventId: result.eventId,
        eventName: result.eventName,
      });
    } catch (err) {
      const code = getApiErrorCode(err);
      if (code === 'GROUP_IS_LOCKED') {
        navigation.replace('AppLocked', {
          creatorName: creatorName ?? undefined,
          eventName: eventName ?? undefined,
        });
        return;
      }
      if (code === 'ALREADY_JOINED') {
        navigation.replace('AppJoined', {
          eventId: '',
          eventName: eventName ?? 'this event',
        });
        return;
      }
      if (isApiRequestError(err)) {
        setError(err.message);
      } else {
        setError('Could not join this event. Try again.');
      }
    } finally {
      setJoining(false);
    }
  }, [creatorName, eventName, navigation, token]);

  const displayName = user?.display_name ?? 'you';

  return (
    <AuthGradientLayout
      contentStyle={styles.content}
      footer={
        <FadeSlideIn delay={180}>
          <View style={styles.footer}>
            <PrimaryButton
              label={joining ? 'Joining…' : `Join as ${displayName} →`}
              onPress={() => void handleJoin()}
              disabled={loading || joining || !eventName}
              loading={joining}
              accessibilityLabel={`Join ${eventName ?? 'event'} as ${displayName}`}
            />
            {error ? (
              <Text style={styles.error} accessibilityRole="alert">
                {error}
              </Text>
            ) : null}
          </View>
        </FadeSlideIn>
      }
    >
      {loading ? (
        <ActivityIndicator color={authColors.textOnDark} size="large" />
      ) : (
        <FadeSlideIn>
          <Text style={styles.kicker}>You&apos;re invited</Text>
          <Text style={styles.title}>{eventName}</Text>
          <Text style={styles.subtitle}>
            Hosted by {creatorName ?? 'someone'}
          </Text>
          <Text style={styles.body}>
            Tap join to appear in the group. The organiser will see you in real time.
          </Text>
        </FadeSlideIn>
      )}
    </AuthGradientLayout>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  kicker: {
    color: authColors.textOnDarkMuted,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  title: {
    color: authColors.textOnDark,
    fontSize: 32,
    fontWeight: '800',
    marginBottom: 8,
  },
  subtitle: {
    color: authColors.textOnDarkMuted,
    fontSize: 16,
    marginBottom: 16,
  },
  body: {
    color: authColors.textOnDarkMuted,
    fontSize: 15,
    lineHeight: 22,
  },
  footer: {
    gap: 12,
  },
  error: {
    color: '#FCA5A5',
    fontSize: 14,
    textAlign: 'center',
  },
});
