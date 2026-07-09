import { LinearGradient } from 'expo-linear-gradient';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { THEMES } from '../../theme/presets';
import { useTheme } from '../../theme/ThemeContext';
import type { Theme, ThemeId } from '../../theme/types';

const OPTIONS: { id: ThemeId; label: string; description: string }[] = [
  { id: 'aurora', label: 'Aurora', description: 'Frosted glass · teal glow' },
  { id: 'solid', label: 'Solid', description: 'Opaque cards · lime accent' },
];

export const THEME_LABELS: Record<ThemeId, string> = Object.fromEntries(
  OPTIONS.map((option) => [option.id, option.label]),
) as Record<ThemeId, string>;

export const THEME_DESCRIPTIONS: Record<ThemeId, string> = Object.fromEntries(
  OPTIONS.map((option) => [option.id, option.description]),
) as Record<ThemeId, string>;

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    wrap: {
      gap: 12,
    },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 14,
      borderRadius: theme.radiusSm,
      borderWidth: 1,
      borderColor: theme.line,
      backgroundColor: theme.surface,
    },
    optionSelected: {
      borderColor: theme.accent,
      backgroundColor: theme.accentSoft,
    },
    swatch: {
      width: 52,
      height: 52,
      borderRadius: theme.radiusSm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    accentDot: {
      width: 16,
      height: 16,
      borderRadius: 8,
    },
    copy: {
      flex: 1,
      gap: 4,
    },
    label: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.ink2,
      fontFamily: theme.fontDisplay,
    },
    labelSelected: {
      color: theme.ink,
    },
    description: {
      fontSize: 13,
      color: theme.ink3,
      fontFamily: theme.fontBody,
    },
    radio: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 2,
      borderColor: theme.line,
      alignItems: 'center',
      justifyContent: 'center',
    },
    radioFill: {
      width: 11,
      height: 11,
      borderRadius: 6,
    },
  });
}

export function ThemePicker() {
  const { theme, setTheme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <View style={styles.wrap}>
      {OPTIONS.map((option) => {
        const preset = THEMES[option.id];
        const selected = theme.id === option.id;
        return (
          <Pressable
            key={option.id}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={`${option.label} theme`}
            onPress={() => setTheme(option.id)}
            style={[styles.option, selected && styles.optionSelected]}
          >
            <LinearGradient
              colors={preset.bgGradient}
              style={styles.swatch}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={[styles.accentDot, { backgroundColor: preset.accent }]} />
            </LinearGradient>
            <View style={styles.copy}>
              <Text style={[styles.label, selected && styles.labelSelected]}>{option.label}</Text>
              <Text style={styles.description}>{option.description}</Text>
            </View>
            <View style={[styles.radio, selected && { borderColor: theme.accent }]}>
              {selected ? <View style={[styles.radioFill, { backgroundColor: theme.accent }]} /> : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
