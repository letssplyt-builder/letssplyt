import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { EventListItem } from '@letssplyt/shared/event.types';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { useTheme } from '../../theme/ThemeContext';
import type { Theme } from '../../theme/types';
import { EventCard } from './EventCard';

interface EventRoleSectionProps {
  title?: string;
  subtitle?: string;
  titleAccentColor?: string;
  events: EventListItem[];
  emptyMessage: string;
  onEventPress: (eventId: string) => void;
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    section: {
      marginBottom: 20,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 8,
    },
    titleAccent: {
      width: 3,
      height: 16,
      borderRadius: 2,
    },
    subtitle: {
      fontSize: 12,
      color: theme.ink3,
      lineHeight: 16,
      marginTop: -4,
      marginBottom: 8,
      fontFamily: theme.fontBody,
    },
    empty: {
      fontSize: 13,
      color: theme.ink2,
      lineHeight: 18,
      marginBottom: 4,
      fontFamily: theme.fontBody,
    },
  });
}

export function EventRoleSection({
  title,
  subtitle,
  titleAccentColor,
  events,
  emptyMessage,
  onEventPress,
}: EventRoleSectionProps) {
  const { theme } = useTheme();
  const themed = useThemedStyles();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <View style={styles.section}>
      {title ? (
        <View style={styles.titleRow}>
          {titleAccentColor ? (
            <View style={[styles.titleAccent, { backgroundColor: titleAccentColor }]} />
          ) : null}
          <Text style={themed.sectionTitle}>{title}</Text>
        </View>
      ) : null}
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {events.length === 0 ? <Text style={styles.empty}>{emptyMessage}</Text> : null}
      {events.map((event) => (
        <EventCard
          key={event.id}
          event={event}
          variant="compact"
          onPress={() => onEventPress(event.id)}
        />
      ))}
    </View>
  );
}
