import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { EventsScreen } from '../screens/events/EventsScreen';
import { EventDetailScreen } from '../screens/events/EventDetailScreen';
import { ItemReviewScreen } from '../screens/receipts/ItemReviewScreen';
import { ReceiptPreviewScreen } from '../screens/receipts/ReceiptPreviewScreen';
import { ReceiptScanScreen } from '../screens/receipts/ReceiptScanScreen';
import { SplitEntryScreen } from '../screens/splits/SplitEntryScreen';
import { MessagePreviewScreen } from '../screens/messages/MessagePreviewScreen';
import { SplitReviewScreen } from '../screens/splits/SplitReviewScreen';
import type { EventsStackParamList } from './types';

const EventsStack = createNativeStackNavigator<EventsStackParamList>();

export function EventsStackNavigator() {
  return (
    <EventsStack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <EventsStack.Screen name="Events" component={EventsScreen} />
      <EventsStack.Screen name="EventDetail" component={EventDetailScreen} />
      <EventsStack.Screen name="ReceiptScan" component={ReceiptScanScreen} />
      <EventsStack.Screen name="ReceiptPreview" component={ReceiptPreviewScreen} />
      <EventsStack.Screen name="ItemReview" component={ItemReviewScreen} />
      <EventsStack.Screen name="SplitEntry" component={SplitEntryScreen} />
      <EventsStack.Screen name="SplitReview" component={SplitReviewScreen} />
      <EventsStack.Screen name="MessagePreview" component={MessagePreviewScreen} />
    </EventsStack.Navigator>
  );
}
