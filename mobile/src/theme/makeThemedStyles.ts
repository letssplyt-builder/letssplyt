import { StyleSheet } from 'react-native';
import type { Theme } from './types';

/** Theme-aware replacements for legacy `glassStyles` — use via `useThemedStyles()`. */
export function makeThemedStyles(theme: Theme) {
  return StyleSheet.create({
    card: {
      backgroundColor: theme.surface,
      borderRadius: theme.radius,
      borderWidth: 1,
      borderColor: theme.line,
      padding: 16,
    },
    cardStrong: {
      backgroundColor: theme.surfaceStrong,
      borderRadius: theme.radius,
      borderWidth: 1,
      borderColor: theme.line,
      padding: 16,
    },
    sectionTitle: {
      fontSize: 11,
      fontWeight: '700',
      color: theme.ink3,
      textTransform: 'uppercase',
      letterSpacing: 0.9,
      marginBottom: 10,
      fontFamily: theme.fontBody,
    },
    title: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.ink,
      fontFamily: theme.fontBody,
    },
    heading: {
      fontSize: 22,
      fontWeight: '800',
      color: theme.ink,
      fontFamily: theme.fontDisplay,
    },
    subheading: {
      fontSize: 13,
      color: theme.ink2,
      fontFamily: theme.fontBody,
    },
    meta: {
      fontSize: 12,
      color: theme.ink2,
      fontFamily: theme.fontBody,
    },
    chip: {
      backgroundColor: theme.accentSoft,
      paddingHorizontal: 9,
      paddingVertical: 3,
      borderRadius: 100,
    },
    chipText: {
      fontSize: 10,
      fontWeight: '700',
      color: theme.accent,
      fontFamily: theme.fontBody,
    },
    ghostButton: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: theme.radiusSm,
      borderWidth: 1.5,
      borderColor: theme.line,
      backgroundColor: theme.surface,
    },
    ghostButtonText: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.ink,
      fontFamily: theme.fontBody,
    },
    attentionCard: {
      backgroundColor: theme.warnSoft,
      borderRadius: theme.radiusSm,
      borderWidth: 1,
      borderColor: theme.warn,
      padding: 14,
      marginBottom: 8,
    },
    attentionTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.ink,
      fontFamily: theme.fontBody,
    },
    attentionMeta: {
      fontSize: 12,
      color: theme.warn,
      marginTop: 2,
      fontFamily: theme.fontBody,
    },
    errorText: {
      fontSize: 13,
      color: theme.bad,
      fontFamily: theme.fontBody,
    },
    emptyText: {
      fontSize: 14,
      color: theme.ink2,
      lineHeight: 20,
      fontFamily: theme.fontBody,
    },
  });
}

export type ThemedStyles = ReturnType<typeof makeThemedStyles>;
