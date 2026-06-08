import { StyleSheet } from 'react-native';
import { authColors } from './colors';

export const glassStyles = StyleSheet.create({
  card: {
    backgroundColor: authColors.glass,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: authColors.glassBorder,
    padding: 16,
  },
  cardStrong: {
    backgroundColor: authColors.glassStrong,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: authColors.glassBorder,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: authColors.textOnDarkFaint,
    textTransform: 'uppercase',
    letterSpacing: 0.9,
    marginBottom: 10,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: authColors.textOnDark,
  },
  heading: {
    fontSize: 22,
    fontWeight: '800',
    color: authColors.textOnDark,
  },
  subheading: {
    fontSize: 13,
    color: authColors.textOnDarkMuted,
  },
  meta: {
    fontSize: 12,
    color: authColors.textOnDarkMuted,
  },
  chip: {
    backgroundColor: authColors.pillOnDark,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 100,
  },
  chipText: {
    fontSize: 10,
    fontWeight: '700',
    color: authColors.textOnDark,
  },
  ghostButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: authColors.glassBorder,
    backgroundColor: authColors.glass,
  },
  ghostButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: authColors.textOnDark,
  },
  attentionCard: {
    backgroundColor: 'rgba(245, 158, 11, 0.14)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.35)',
    padding: 14,
    marginBottom: 8,
  },
  attentionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: authColors.textOnDark,
  },
  attentionMeta: {
    fontSize: 12,
    color: '#FCD34D',
    marginTop: 2,
  },
  errorText: {
    fontSize: 13,
    color: authColors.errorOnDark,
  },
  emptyText: {
    fontSize: 14,
    color: authColors.textOnDarkMuted,
    lineHeight: 20,
  },
});
