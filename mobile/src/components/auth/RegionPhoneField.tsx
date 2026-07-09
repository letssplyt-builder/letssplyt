import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  AUTH_COUNTRIES,
  handleUsNationalPhoneInput,
  SUPPORTED_AUTH_REGIONS,
  US_NATIONAL_DISPLAY_MAX_LENGTH,
  type AuthCountryCode,
} from '../../utils/phone';
import { useTheme } from '../../theme/ThemeContext';
import type { Theme } from '../../theme/types';

interface RegionPhoneFieldProps {
  region: AuthCountryCode;
  onRegionChange?: (region: AuthCountryCode) => void;
  value: string;
  onChangeText: (text: string) => void;
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    wrap: {
      width: '100%',
      gap: 12,
    },
    regionBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      alignSelf: 'center',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 100,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.line,
    },
    regionBadgeFlag: {
      fontSize: 14,
    },
    regionBadgeText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.ink2,
      letterSpacing: 0.3,
      fontFamily: theme.fontBody,
    },
    segmentRow: {
      flexDirection: 'row',
      gap: 10,
    },
    segment: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 12,
      borderRadius: theme.radiusSm,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.line,
    },
    segmentActive: {
      backgroundColor: theme.accent,
      borderColor: theme.accent,
    },
    segmentFlag: {
      fontSize: 16,
    },
    segmentLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.ink2,
      fontFamily: theme.fontBody,
    },
    segmentLabelActive: {
      color: theme.accentInk,
    },
    inputCard: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 54,
      paddingHorizontal: 16,
      borderRadius: theme.radiusSm,
      borderWidth: 1.5,
    },
    dialCode: {
      fontSize: 17,
      fontWeight: '600',
      color: theme.ink2,
      letterSpacing: 0.2,
      minWidth: 28,
      fontFamily: theme.fontBody,
    },
    divider: {
      width: 1,
      height: 22,
      backgroundColor: theme.line,
      marginHorizontal: 12,
    },
    input: {
      flex: 1,
      fontSize: 18,
      fontWeight: '500',
      color: theme.ink,
      letterSpacing: 0.4,
      paddingVertical: 0,
      minHeight: 24,
      fontFamily: theme.fontBody,
    },
  });
}

export function RegionPhoneField({
  region,
  onRegionChange,
  value,
  onChangeText,
}: RegionPhoneFieldProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const meta = AUTH_COUNTRIES[region];
  const showRegionPicker = SUPPORTED_AUTH_REGIONS.length > 1 && onRegionChange;
  const [focused, setFocused] = useState(false);
  const focusAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(focusAnim, {
      toValue: focused ? 1 : 0,
      duration: 220,
      useNativeDriver: false,
    }).start();
  }, [focused, focusAnim]);

  const borderColor = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [theme.line, theme.accent],
  });

  const cardBg = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [theme.surface, theme.surfaceStrong],
  });

  return (
    <View style={styles.wrap}>
      {showRegionPicker ? (
        <View style={styles.segmentRow}>
          {SUPPORTED_AUTH_REGIONS.map((code) => {
            const active = code === region;
            const item = AUTH_COUNTRIES[code];
            return (
              <Pressable
                key={code}
                accessibilityRole="button"
                accessibilityLabel={`Select ${item.label}`}
                accessibilityState={{ selected: active }}
                onPress={() => onRegionChange?.(code)}
                style={[styles.segment, active && styles.segmentActive]}
              >
                <Text style={styles.segmentFlag}>{item.flag}</Text>
                <Text style={[styles.segmentLabel, active && styles.segmentLabelActive]}>
                  {code === 'US' ? 'US' : item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <View style={styles.regionBadge}>
          <Text style={styles.regionBadgeFlag}>{meta.flag}</Text>
          <Text style={styles.regionBadgeText}>US {meta.dial}</Text>
        </View>
      )}

      <Animated.View
        style={[
          styles.inputCard,
          {
            borderColor,
            backgroundColor: cardBg,
          },
        ]}
      >
        <Text style={styles.dialCode}>{meta.dial}</Text>
        <View style={styles.divider} />
        <TextInput
          accessibilityLabel="Phone number"
          accessibilityHint={`Enter your ${meta.label} mobile number`}
          keyboardType="phone-pad"
          placeholder="(555) - 000 - 0000"
          placeholderTextColor={theme.ink3}
          value={value}
          onChangeText={(text) => onChangeText(handleUsNationalPhoneInput(text))}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={styles.input}
          autoFocus
          maxLength={US_NATIONAL_DISPLAY_MAX_LENGTH}
        />
      </Animated.View>
    </View>
  );
}
