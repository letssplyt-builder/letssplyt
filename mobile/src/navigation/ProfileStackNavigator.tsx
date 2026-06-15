import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AddHandleScreen } from '../screens/profile/AddHandleScreen';
import { ProfileScreen } from '../screens/profile/ProfileScreen';
import type { ProfileStackParamList } from './types';

const ProfileStack = createNativeStackNavigator<ProfileStackParamList>();

export function ProfileStackNavigator() {
  return (
    <ProfileStack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <ProfileStack.Screen name="Profile" component={ProfileScreen} />
      <ProfileStack.Screen name="AddHandle" component={AddHandleScreen} />
    </ProfileStack.Navigator>
  );
}
