import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { HomeScreen } from '../screens/home/HomeScreen';
import { MemberDetailScreen } from '../screens/home/MemberDetailScreen';
import { GuestDetailScreen } from '../screens/home/GuestDetailScreen';
import { NotificationsScreen } from '../screens/notifications/NotificationsScreen';
import type { HomeStackParamList } from './types';

const HomeStack = createNativeStackNavigator<HomeStackParamList>();

export function HomeStackNavigator() {
  return (
    <HomeStack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <HomeStack.Screen name="Home" component={HomeScreen} />
      <HomeStack.Screen name="Notifications" component={NotificationsScreen} />
      <HomeStack.Screen name="MemberDetail" component={MemberDetailScreen} />
      <HomeStack.Screen name="GuestDetail" component={GuestDetailScreen} />
    </HomeStack.Navigator>
  );
}
