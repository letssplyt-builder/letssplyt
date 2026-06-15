import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AddHandleScreen } from '../screens/profile/AddHandleScreen';
import { DeleteConfirmScreen } from '../screens/profile/DeleteConfirmScreen';
import { DeleteWarnScreen } from '../screens/profile/DeleteWarnScreen';
import { DeletedScreen } from '../screens/profile/DeletedScreen';
import { LegalDocumentScreen } from '../screens/profile/LegalDocumentScreen';
import { ProfileScreen } from '../screens/profile/ProfileScreen';
import { SettingsScreen } from '../screens/profile/SettingsScreen';
import type { SettingsStackParamList } from './types';

const SettingsStack = createNativeStackNavigator<SettingsStackParamList>();

export function SettingsStackNavigator() {
  return (
    <SettingsStack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <SettingsStack.Screen name="Settings" component={SettingsScreen} />
      <SettingsStack.Screen name="Profile" component={ProfileScreen} />
      <SettingsStack.Screen name="AddHandle" component={AddHandleScreen} />
      <SettingsStack.Screen name="DeleteWarn" component={DeleteWarnScreen} />
      <SettingsStack.Screen name="DeleteConfirm" component={DeleteConfirmScreen} />
      <SettingsStack.Screen name="Deleted" component={DeletedScreen} />
      <SettingsStack.Screen name="LegalDocument" component={LegalDocumentScreen} />
    </SettingsStack.Navigator>
  );
}
