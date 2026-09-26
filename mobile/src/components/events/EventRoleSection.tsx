import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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

export function eventSectionHeaderLabel(title: string, count: number): string {
  return `${title} · ${count}`;
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    section: {
      marginBottom: 20,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 4,
      marginBottom: 8,
    },
    headerPressed: {
      opacity: 0.75,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flex: 1,
    },
    titleAccent: {
      width: 3,
      height: 16,
      borderRadius: 2,
    },
    headerLabel: {
      flex: 1,
      marginBottom: 0,
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
  const [expanded, setExpanded] = useState(true);
  const count = events.length;
  const headerLabel = title ? eventSectionHeaderLabel(title, count) : null;

  return (
    <View style={styles.section}>
      {title && headerLabel ? (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          accessibilityLabel={`${title}, ${count} ${count === 1 ? 'event' : 'events'}`}
          onPress={() => setExpanded((current) => !current)}
          style={({ pressed }) => [styles.header, pressed && styles.headerPressed]}
        >
          <View style={styles.titleRow}>
            {titleAccentColor ? (
              <View style={[styles.titleAccent, { backgroundColor: titleAccentColor }]} />
            ) : null}
            <Text style={[themed.sectionTitle, styles.headerLabel]}>{headerLabel}</Text>
          </View>
          <Ionicons
            name={expanded ? 'chevron-down' : 'chevron-forward'}
            size={16}
            color={theme.ink3}
          />
        </Pressable>
      ) : null}
      {expanded ? (
        <>
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
        </>
      ) : null}
    </View>
  );
}
