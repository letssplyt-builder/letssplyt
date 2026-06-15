import { useEffect, useRef } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { BiometricLockScreen } from '../screens/auth/BiometricLockScreen';
import { BiometricOptInScreen } from '../screens/auth/BiometricOptInScreen';
import { OTPVerifyScreen } from '../screens/auth/OTPVerifyScreen';
import { PhoneEntryScreen } from '../screens/auth/PhoneEntryScreen';
import { WelcomeScreen } from '../screens/auth/WelcomeScreen';
import { AppJoinedScreen } from '../screens/join/AppJoinedScreen';
import { AppJoinScreen } from '../screens/join/AppJoinScreen';
import { AppLockedScreen } from '../screens/join/AppLockedScreen';
import { MainTabNavigator } from './MainTabNavigator';
import { PushPermissionScreen } from '../screens/profile/PushPermissionScreen';
import { LegalDocumentScreen } from '../screens/profile/LegalDocumentScreen';
import { useAppLock } from '../hooks/useAppLock';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { Toast } from '../components/Toast';
import { useAuthStore } from '../store/authStore';
import { useJoinStore } from '../store/joinStore';
import { resolveAuthenticatedRoute } from './authFlowNavigation';
import { linking } from './linking';
import { navigationRef } from './navigationRef';
import type { RootStackParamList } from './types';

const RootStack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const session = useAuthStore((state) => state.session);
  const isBootstrapping = useAuthStore((state) => state.isBootstrapping);
  const isUnlocked = useAuthStore((state) => state.isUnlocked);
  const hasStoredCredentials = useAuthStore((state) => state.hasStoredCredentials);
  const needsPushPermission = useAuthStore((state) => state.needsPushPermission);
  const pendingBiometricOptIn = useAuthStore((state) => state.pendingBiometricOptIn);
  const pendingJoinToken = useJoinStore((state) => state.pendingJoinToken);
  const initAuthListener = useAuthStore((state) => state.initAuthListener);
  const bootstrapFromStorage = useAuthStore((state) => state.bootstrapFromStorage);

  const wasAuthenticatedRef = useRef(false);

  const showLockScreen = !isBootstrapping && hasStoredCredentials && !isUnlocked;
  const isAuthenticated = Boolean(isUnlocked && session?.access_token);

  useAppLock();
  usePushNotifications(isAuthenticated);

  useEffect(() => {
    const { unsubscribe } = initAuthListener();
    return unsubscribe;
  }, [initAuthListener]);

  useEffect(() => {
    void bootstrapFromStorage();
  }, [bootstrapFromStorage]);

  useEffect(() => {
    if (!navigationRef.isReady() || isBootstrapping) return;

    if (showLockScreen) {
      navigationRef.reset({ index: 0, routes: [{ name: 'BiometricLock' }] });
      wasAuthenticatedRef.current = isAuthenticated;
      return;
    }

    if (isAuthenticated) {
      const route = resolveAuthenticatedRoute(
        pendingBiometricOptIn,
        pendingJoinToken,
        needsPushPermission,
      );
      navigationRef.reset({
        index: 0,
        routes: [
          route === 'AppJoin' && pendingJoinToken
            ? { name: 'AppJoin', params: { token: pendingJoinToken } }
            : { name: route },
        ],
      });
      wasAuthenticatedRef.current = true;
      return;
    }

    if (wasAuthenticatedRef.current) {
      navigationRef.reset({ index: 0, routes: [{ name: 'Welcome' }] });
    }
    wasAuthenticatedRef.current = false;
  }, [
    isAuthenticated,
    isBootstrapping,
    showLockScreen,
    pendingBiometricOptIn,
    pendingJoinToken,
    needsPushPermission,
  ]);

  useEffect(() => {
    if (!isAuthenticated || !pendingJoinToken || !navigationRef.isReady()) return;
    navigationRef.navigate('AppJoin', { token: pendingJoinToken });
  }, [isAuthenticated, pendingJoinToken]);

  const initialRouteName = showLockScreen
    ? 'BiometricLock'
    : isAuthenticated
      ? resolveAuthenticatedRoute(pendingBiometricOptIn, pendingJoinToken, needsPushPermission)
      : pendingJoinToken
        ? 'PhoneEntry'
        : 'Welcome';

  if (isBootstrapping) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef} linking={linking}>
      <Toast />
      <RootStack.Navigator
        screenOptions={{
          headerShown: false,
          animation: 'fade',
          animationDuration: 280,
        }}
        initialRouteName={initialRouteName}
      >
        <RootStack.Screen name="BiometricLock" component={BiometricLockScreen} />
        <RootStack.Screen name="Welcome" component={WelcomeScreen} />
        <RootStack.Screen name="PhoneEntry" component={PhoneEntryScreen} />
        <RootStack.Screen name="LegalDocument" component={LegalDocumentScreen} />
        <RootStack.Screen name="OTPVerify" component={OTPVerifyScreen} />
        <RootStack.Screen name="BiometricOptIn" component={BiometricOptInScreen} />
        <RootStack.Screen name="PushPermission" component={PushPermissionScreen} />
        <RootStack.Screen name="MainTabs" component={MainTabNavigator} />
        <RootStack.Screen
          name="AppJoin"
          component={AppJoinScreen}
          initialParams={pendingJoinToken ? { token: pendingJoinToken } : undefined}
        />
        <RootStack.Screen name="AppJoined" component={AppJoinedScreen} />
        <RootStack.Screen name="AppLocked" component={AppLockedScreen} />
      </RootStack.Navigator>
    </NavigationContainer>
  );
}
