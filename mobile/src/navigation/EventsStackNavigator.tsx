import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { EventsScreen } from '../screens/events/EventsScreen';
import { EventDetailScreen } from '../screens/events/EventDetailScreen';
import type { EventsStackParamList } from './types';

const EventsStack = createNativeStackNavigator<EventsStackParamList>();

export function EventsStackNavigator() {
  return (
    <EventsStack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <EventsStack.Screen name="Events" component={EventsScreen} />
      <EventsStack.Screen name="EventDetail" component={EventDetailScreen} />
    </EventsStack.Navigator>
  );
}
