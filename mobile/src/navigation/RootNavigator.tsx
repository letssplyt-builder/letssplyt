import { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { OTPVerifyScreen } from '../screens/auth/OTPVerifyScreen';
import { PhoneEntryScreen } from '../screens/auth/PhoneEntryScreen';
import { WelcomeScreen } from '../screens/auth/WelcomeScreen';
import { HomeScreen } from '../screens/home/HomeScreen';
import { AddHandleScreen } from '../screens/profile/AddHandleScreen';
import { ProfileScreen } from '../screens/profile/ProfileScreen';
import { PushPermissionScreen } from '../screens/profile/PushPermissionScreen';
import { useAuthStore } from '../store/authStore';
import type { RootStackParamList } from './types';

const RootStack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const session = useAuthStore((state) => state.session);
  const needsPushPermission = useAuthStore((state) => state.needsPushPermission);
  const initAuthListener = useAuthStore((state) => state.initAuthListener);
  const restoreFromSecureStore = useAuthStore((state) => state.restoreFromSecureStore);

  useEffect(() => {
    const { unsubscribe } = initAuthListener();
    return unsubscribe;
  }, [initAuthListener]);

  useEffect(() => {
    void restoreFromSecureStore();
  }, [restoreFromSecureStore]);

  const isAuthenticated = Boolean(session?.access_token);

  return (
    <NavigationContainer>
      <RootStack.Navigator
        key={isAuthenticated ? 'authenticated' : 'guest'}
        screenOptions={{
          headerShown: false,
          animation: 'fade',
          animationDuration: 280,
        }}
        initialRouteName={
          isAuthenticated ? (needsPushPermission ? 'PushPermission' : 'Home') : 'Welcome'
        }
      >
        {isAuthenticated ? (
          <>
            <RootStack.Screen name="PushPermission" component={PushPermissionScreen} />
            <RootStack.Screen name="Home" component={HomeScreen} />
            <RootStack.Screen name="Profile" component={ProfileScreen} />
            <RootStack.Screen name="AddHandle" component={AddHandleScreen} />
          </>
        ) : (
          <>
            <RootStack.Screen name="Welcome" component={WelcomeScreen} />
            <RootStack.Screen name="PhoneEntry" component={PhoneEntryScreen} />
            <RootStack.Screen name="OTPVerify" component={OTPVerifyScreen} />
          </>
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}
