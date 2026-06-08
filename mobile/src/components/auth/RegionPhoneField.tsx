import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  AUTH_COUNTRIES,
  SUPPORTED_AUTH_REGIONS,
  type AuthCountryCode,
} from '../../utils/phone';
import { authColors } from '../../theme/colors';

interface RegionPhoneFieldProps {
  region: AuthCountryCode;
  onRegionChange?: (region: AuthCountryCode) => void;
  value: string;
  onChangeText: (text: string) => void;
}

export function RegionPhoneField({
  region,
  onRegionChange,
  value,
  onChangeText,
}: RegionPhoneFieldProps) {
  const meta = AUTH_COUNTRIES[region];
  const showRegionPicker = SUPPORTED_AUTH_REGIONS.length > 1 && onRegionChange;
  const [focused, setFocused] = useState(false);
  const focusAnim = useRef(new Animated.Value(0)).current;
  const breathe = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(focusAnim, {
      toValue: focused ? 1 : 0,
      duration: 220,
      useNativeDriver: false,
    }).start();
  }, [focused, focusAnim]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, { toValue: 1, duration: 2400, useNativeDriver: true }),
        Animated.timing(breathe, { toValue: 0, duration: 2400, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [breathe]);

  const cardScale = breathe.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.008],
  });

  const borderColor = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [authColors.glassBorder, 'rgba(255, 255, 255, 0.55)'],
  });

  const cardBg = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [authColors.glassStrong, 'rgba(255, 255, 255, 0.2)'],
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
          <Text style={styles.regionBadgeText}>United States · {meta.dial}</Text>
        </View>
      )}

      {/* Outer: transform (native driver). Inner: colors (JS driver). Never mix on one node. */}
      <Animated.View style={{ transform: [{ scale: cardScale }] }}>
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
            placeholder={meta.placeholder}
            placeholderTextColor={authColors.textOnDarkFaint}
            value={value}
            onChangeText={(text) => onChangeText(text.replace(/[^\d\s()-]/g, ''))}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            style={styles.input}
            autoFocus
            maxLength={16}
          />
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    gap: 16,
  },
  regionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 100,
    backgroundColor: authColors.pillOnDark,
    borderWidth: 1,
    borderColor: authColors.glassBorder,
  },
  regionBadgeFlag: {
    fontSize: 16,
  },
  regionBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: authColors.textOnDarkMuted,
    letterSpacing: 0.2,
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
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: authColors.segmentInactive,
    borderWidth: 1,
    borderColor: authColors.glassBorder,
  },
  segmentActive: {
    backgroundColor: authColors.segmentActive,
    borderColor: authColors.segmentActive,
  },
  segmentFlag: {
    fontSize: 18,
  },
  segmentLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: authColors.segmentInactiveText,
  },
  segmentLabelActive: {
    color: authColors.segmentActiveText,
  },
  inputCard: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 88,
    paddingHorizontal: 22,
    borderRadius: 24,
    borderWidth: 1,
  },
  dialCode: {
    fontSize: 28,
    fontWeight: '700',
    color: authColors.textOnDark,
    letterSpacing: -0.5,
  },
  divider: {
    width: 1,
    height: 40,
    backgroundColor: authColors.glassBorder,
    marginHorizontal: 18,
  },
  input: {
    flex: 1,
    fontSize: 32,
    fontWeight: '600',
    color: authColors.textOnDark,
    letterSpacing: 0.5,
    paddingVertical: 8,
  },
});
