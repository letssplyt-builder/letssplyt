import { StyleSheet, Text, View } from 'react-native';
import type { EventListItem } from '@letssplyt/shared/event.types';
import { EventCard } from './EventCard';
import { glassStyles } from '../../theme/glassStyles';
import { authColors } from '../../theme/colors';

interface EventRoleSectionProps {
  title: string;
  events: EventListItem[];
  emptyMessage: string;
  onEventPress: (eventId: string) => void;
}

export function EventRoleSection({
  title,
  events,
  emptyMessage,
  onEventPress,
}: EventRoleSectionProps) {
  return (
    <View style={styles.section}>
      <Text style={glassStyles.sectionTitle}>{title}</Text>
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
  empty: {
    fontSize: 13,
    color: authColors.textOnDarkMuted,
    lineHeight: 18,
    marginBottom: 4,
  },
});
