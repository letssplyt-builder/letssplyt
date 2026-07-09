import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StyleSheet, Text } from 'react-native';
import { FadeSlideIn } from '../../components/auth/FadeSlideIn';
import { ThemedScreenLayout } from '../../components/layout/ThemedScreenLayout';
import { ThemePicker } from '../../components/settings/ThemePicker';
import { useAppInsets } from '../../hooks/useAppInsets';
import type { SettingsStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme/ThemeContext';

type Props = NativeStackScreenProps<SettingsStackParamList, 'Appearance'>;

export function AppearanceScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const { screenScrollBottomPadding } = useAppInsets();

  return (
    <ThemedScreenLayout
      topBar={{
        title: 'Appearance',
        onBack: () => navigation.goBack(),
      }}
      scrollContentContainerStyle={{ paddingBottom: screenScrollBottomPadding }}
    >
      <FadeSlideIn delay={0}>
        <Text style={[styles.subtitle, { color: theme.ink2 }]}>
          Choose how LetsSplyt looks on your device.
        </Text>
      </FadeSlideIn>

      <FadeSlideIn delay={60}>
        <ThemePicker />
      </FadeSlideIn>
    </ThemedScreenLayout>
  );
}

const styles = StyleSheet.create({
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 24,
    marginTop: 4,
  },
});
