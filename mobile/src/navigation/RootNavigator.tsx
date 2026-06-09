import { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { OTPVerifyScreen } from '../screens/auth/OTPVerifyScreen';
import { PhoneEntryScreen } from '../screens/auth/PhoneEntryScreen';
import { WelcomeScreen } from '../screens/auth/WelcomeScreen';
import { AppJoinedScreen } from '../screens/join/AppJoinedScreen';
import { AppJoinScreen } from '../screens/join/AppJoinScreen';
import { AppLockedScreen } from '../screens/join/AppLockedScreen';
import { MainTabNavigator } from './MainTabNavigator';
import { AddHandleScreen } from '../screens/profile/AddHandleScreen';
import { ProfileScreen } from '../screens/profile/ProfileScreen';
import { PushPermissionScreen } from '../screens/profile/PushPermissionScreen';
import { useAuthStore } from '../store/authStore';
import { useJoinStore } from '../store/joinStore';
import { linking } from './linking';
import { navigationRef } from './navigationRef';
import type { RootStackParamList } from './types';

const RootStack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const session = useAuthStore((state) => state.session);
  const needsPushPermission = useAuthStore((state) => state.needsPushPermission);
  const pendingJoinToken = useJoinStore((state) => state.pendingJoinToken);
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

  useEffect(() => {
    if (!isAuthenticated || !pendingJoinToken || !navigationRef.isReady()) return;

    navigationRef.navigate('AppJoin', { token: pendingJoinToken });
  }, [isAuthenticated, pendingJoinToken]);

  const authenticatedInitialRoute = pendingJoinToken
    ? 'AppJoin'
    : needsPushPermission
      ? 'PushPermission'
      : 'MainTabs';

  return (
    <NavigationContainer ref={navigationRef} linking={linking}>
      <RootStack.Navigator
        key={isAuthenticated ? 'authenticated' : 'guest'}
        screenOptions={{
          headerShown: false,
          animation: 'fade',
          animationDuration: 280,
        }}
        initialRouteName={
          isAuthenticated
            ? authenticatedInitialRoute
            : pendingJoinToken
              ? 'PhoneEntry'
              : 'Welcome'
        }
      >
        {isAuthenticated ? (
          <>
            <RootStack.Screen name="PushPermission" component={PushPermissionScreen} />
            <RootStack.Screen name="MainTabs" component={MainTabNavigator} />
            <RootStack.Screen
              name="AppJoin"
              component={AppJoinScreen}
              initialParams={pendingJoinToken ? { token: pendingJoinToken } : undefined}
            />
            <RootStack.Screen name="AppJoined" component={AppJoinedScreen} />
            <RootStack.Screen name="AppLocked" component={AppLockedScreen} />
            <RootStack.Screen name="Profile" component={ProfileScreen} />
            <RootStack.Screen name="AddHandle" component={AddHandleScreen} />
          </>
        ) : (
          <>
            <RootStack.Screen name="Welcome" component={WelcomeScreen} />
            <RootStack.Screen
              name="PhoneEntry"
              component={PhoneEntryScreen}
              initialParams={
                pendingJoinToken ? { joinToken: pendingJoinToken } : undefined
              }
              key={pendingJoinToken ? `phone-join-${pendingJoinToken}` : 'phone-default'}
            />
            <RootStack.Screen name="OTPVerify" component={OTPVerifyScreen} />
          </>
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}
