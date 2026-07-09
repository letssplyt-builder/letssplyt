import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { SCREEN_HORIZONTAL_PADDING } from '../../constants/layout';
import { useTheme } from '../../theme/ThemeContext';
import type { Theme } from '../../theme/types';

const ICON_SLOT = 40;

type ScreenTopBarProps = {
  /** Centered or leading title for stack screens. */
  title?: string;
  subtitle?: string;
  /** When `start`, title/subtitle align left beside the back control. */
  titleAlign?: 'center' | 'start';
  onBack?: () => void;
  backLabel?: string;
  /** Left content for root tab headers (e.g. greeting). Overrides back button when set. */
  leading?: ReactNode;
  /** Right action — menu, status chip, notification bell, etc. */
  trailing?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export type { ScreenTopBarProps };

function makeStyles(theme: Theme) {
  const iconRadius = theme.id === 'aurora' ? 20 : theme.radiusSm;

  return StyleSheet.create({
    wrapper: {
      paddingHorizontal: SCREEN_HORIZONTAL_PADDING,
      paddingTop: 4,
      paddingBottom: 4,
    },
    rootRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 16,
      minHeight: ICON_SLOT,
    },
    leadingSlot: {
      flex: 1,
      minWidth: 0,
      justifyContent: 'center',
    },
    stackRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      minHeight: ICON_SLOT,
    },
    stackRowStart: {
      alignItems: 'flex-start',
    },
    titleRail: {
      flex: 1,
      minWidth: 0,
      justifyContent: 'center',
    },
    titleRailCenter: {
      alignItems: 'center',
    },
    trailingSlot: {
      alignItems: 'flex-end',
      justifyContent: 'center',
      minHeight: ICON_SLOT,
      flexShrink: 0,
    },
    sideSlot: {
      width: ICON_SLOT,
      alignItems: 'center',
      justifyContent: 'center',
    },
    trailingSideSlot: {
      minWidth: ICON_SLOT,
      flexShrink: 0,
      alignItems: 'flex-end',
      justifyContent: 'center',
    },
    iconBtn: {
      width: ICON_SLOT,
      height: ICON_SLOT,
      borderRadius: iconRadius,
      borderWidth: 1,
      borderColor: theme.line,
      backgroundColor: theme.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconBtnPressed: {
      backgroundColor: theme.surfaceStrong,
      transform: [{ scale: 0.96 }],
    },
    backTextBtn: {
      height: ICON_SLOT,
      paddingHorizontal: 14,
      borderRadius: iconRadius,
      borderWidth: 1,
      borderColor: theme.line,
      backgroundColor: theme.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    backText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.ink2,
      fontFamily: theme.fontBody,
    },
    title: {
      fontSize: 20,
      fontWeight: '800',
      color: theme.ink,
      letterSpacing: -0.35,
      fontFamily: theme.fontDisplay,
    },
    titleCenter: {
      textAlign: 'center',
    },
    subtitle: {
      marginTop: 3,
      fontSize: 13,
      fontWeight: '500',
      color: theme.ink3,
      fontFamily: theme.fontBody,
    },
    subtitleCenter: {
      textAlign: 'center',
    },
    accentLine: {
      height: 1,
      marginTop: 14,
      opacity: 0.55,
    },
    slotPlaceholder: {
      width: ICON_SLOT,
      height: ICON_SLOT,
    },
  });
}

function HeaderIconButton({
  onPress,
  accessibilityLabel,
  children,
  style,
  pressedStyle,
}: {
  onPress: () => void;
  accessibilityLabel: string;
  children: ReactNode;
  style: ViewStyle;
  pressedStyle: ViewStyle;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [style, pressed && pressedStyle]}
    >
      {children}
    </Pressable>
  );
}

/**
 * Lightweight floating header — transparent over the canvas, glass icon controls, soft accent rule.
 */
export function ScreenTopBar({
  title,
  subtitle,
  titleAlign = 'center',
  onBack,
  backLabel,
  leading,
  trailing,
  style,
}: ScreenTopBarProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const titleIsStart = titleAlign === 'start';
  const showAccentLine = Boolean(title || leading);

  const backControl =
    leading != null ? null : onBack ? (
      backLabel && backLabel !== '← Back' ? (
        <HeaderIconButton
          onPress={onBack}
          accessibilityLabel="Go back"
          style={styles.backTextBtn}
          pressedStyle={styles.iconBtnPressed}
        >
          <Text style={styles.backText}>{backLabel}</Text>
        </HeaderIconButton>
      ) : (
        <HeaderIconButton
          onPress={onBack}
          accessibilityLabel="Go back"
          style={styles.iconBtn}
          pressedStyle={styles.iconBtnPressed}
        >
          <Ionicons name="chevron-back" size={22} color={theme.ink} />
        </HeaderIconButton>
      )
    ) : (
      <View style={styles.slotPlaceholder} />
    );

  const titleBlock = title ? (
    <>
      <Text
        style={[styles.title, !titleIsStart && styles.titleCenter]}
        numberOfLines={1}
      >
        {title}
      </Text>
      {subtitle ? (
        <Text
          style={[styles.subtitle, !titleIsStart && styles.subtitleCenter]}
          numberOfLines={1}
        >
          {subtitle}
        </Text>
      ) : null}
    </>
  ) : null;

  const body =
    leading && !title ? (
      <View style={styles.rootRow}>
        <View style={styles.leadingSlot}>{leading}</View>
        {trailing ? <View style={styles.trailingSlot}>{trailing}</View> : null}
      </View>
    ) : titleIsStart ? (
      <View style={[styles.stackRow, subtitle ? styles.stackRowStart : null]}>
        {backControl}
        <View style={styles.titleRail}>{titleBlock}</View>
        <View style={styles.trailingSlot}>
          {trailing ?? <View style={styles.slotPlaceholder} />}
        </View>
      </View>
    ) : (
      <View style={styles.stackRow}>
        <View style={styles.sideSlot}>{backControl}</View>
        <View style={[styles.titleRail, styles.titleRailCenter]}>{titleBlock}</View>
        <View style={styles.trailingSideSlot}>
          {trailing ?? <View style={styles.slotPlaceholder} />}
        </View>
      </View>
    );

  return (
    <View style={[styles.wrapper, style]}>
      {body}
      {showAccentLine ? (
        <LinearGradient
          colors={['transparent', theme.accent, 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.accentLine}
        />
      ) : null}
    </View>
  );
}
