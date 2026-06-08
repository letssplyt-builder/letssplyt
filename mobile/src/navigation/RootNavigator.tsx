import { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { OTPVerifyScreen } from '../screens/auth/OTPVerifyScreen';
import { PhoneEntryScreen } from '../screens/auth/PhoneEntryScreen';
import { WelcomeScreen } from '../screens/auth/WelcomeScreen';
import { HomeScreen } from '../screens/home/HomeScreen';
import { useAuthStore } from '../store/authStore';
import type { RootStackParamList } from './types';

const RootStack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const session = useAuthStore((state) => state.session);
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
        screenOptions={{ headerShown: false }}
        initialRouteName={isAuthenticated ? 'Home' : 'Welcome'}
      >
        {isAuthenticated ? (
          <RootStack.Screen name="Home" component={HomeScreen} />
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
