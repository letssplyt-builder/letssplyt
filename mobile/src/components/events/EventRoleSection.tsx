import { StyleSheet, Text, View } from 'react-native';
import type { EventListItem } from '@letssplyt/shared/event.types';
import { EventCard } from './EventCard';
import { glassStyles } from '../../theme/glassStyles';
import { authColors } from '../../theme/colors';

interface EventRoleSectionProps {
  title?: string;
  subtitle?: string;
  titleAccentColor?: string;
  events: EventListItem[];
  emptyMessage: string;
  onEventPress: (eventId: string) => void;
}

export function EventRoleSection({
  title,
  subtitle,
  titleAccentColor,
  events,
  emptyMessage,
  onEventPress,
}: EventRoleSectionProps) {
  return (
    <View style={styles.section}>
      {title ? (
        <View style={styles.titleRow}>
          {titleAccentColor ? (
            <View style={[styles.titleAccent, { backgroundColor: titleAccentColor }]} />
          ) : null}
          <Text style={glassStyles.sectionTitle}>{title}</Text>
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

const styles = StyleSheet.create({
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
    color: authColors.textOnDarkFaint,
    lineHeight: 16,
    marginTop: -4,
    marginBottom: 8,
  },
  empty: {
    fontSize: 13,
    color: authColors.textOnDarkMuted,
    lineHeight: 18,
    marginBottom: 4,
  },
});
