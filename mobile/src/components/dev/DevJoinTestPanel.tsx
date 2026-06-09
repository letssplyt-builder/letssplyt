import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { useAuthStore } from '../../store/authStore';
import { useJoinStore } from '../../store/joinStore';
import { authColors } from '../../theme/colors';

function parseJoinToken(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return '';

  try {
    if (trimmed.includes('/join/')) {
      const segment = trimmed.split('/join/').pop()?.split(/[?#]/)[0];
      return segment?.trim() ?? '';
    }
  } catch {
    // fall through
  }

  return trimmed;
}

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList>;
};

/**
 * Dev-only helper for Expo Go — Universal Links do not open Expo Go.
 * Remove or keep gated behind __DEV__ before production release.
 */
export function DevJoinTestPanel({ navigation }: Props) {
  const [value, setValue] = useState('');
  const logout = useAuthStore((state) => state.logout);

  if (!__DEV__) return null;

  const token = parseJoinToken(value);

  const openJoinLoggedIn = () => {
    if (!token) return;
    useJoinStore.getState().setPendingJoinToken(token);
    navigation.navigate('AppJoin', { token });
  };

  const openJoinLoggedOut = async () => {
    if (!token) return;
    useJoinStore.getState().setPendingJoinToken(token);
    await logout();
    // Root navigator remounts guest stack with PhoneEntry + joinToken
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Dev: test in-app join (Expo Go)</Text>
      <Text style={styles.hint}>
        Create an event → open QR → copy the join link or token. Paste below.
      </Text>
      <TextInput
        value={value}
        onChangeText={setValue}
        placeholder="join token or full https://…/join/… URL"
        placeholderTextColor={authColors.textOnDarkMuted}
        autoCapitalize="none"
        autoCorrect={false}
        style={styles.input}
      />
      <Pressable
        accessibilityRole="button"
        disabled={!token}
        onPress={openJoinLoggedIn}
        style={[styles.button, !token && styles.buttonDisabled]}
      >
        <Text style={styles.buttonText}>Open join screen (logged in)</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        disabled={!token}
        onPress={() => void openJoinLoggedOut()}
        style={[styles.buttonSecondary, !token && styles.buttonDisabled]}
      >
        <Text style={styles.buttonTextSecondary}>Log out → join flow (OTP)</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 20,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F59E0B',
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    gap: 10,
  },
  title: {
    color: '#FCD34D',
    fontSize: 13,
    fontWeight: '800',
  },
  hint: {
    color: authColors.textOnDarkMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  input: {
    borderWidth: 1,
    borderColor: authColors.glassBorder,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: authColors.textOnDark,
    fontSize: 14,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  button: {
    backgroundColor: '#F59E0B',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonSecondary: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonText: {
    color: '#1E1B3A',
    fontSize: 14,
    fontWeight: '700',
  },
  buttonTextSecondary: {
    color: '#FCD34D',
    fontSize: 14,
    fontWeight: '700',
  },
});
