import * as Sentry from '@sentry/react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RootNavigator } from './src/navigation/RootNavigator';
import { withOptionalSentryWrap } from './src/utils/sentryAppRoot';

const sentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
const appEnv = process.env.EXPO_PUBLIC_APP_ENV ?? process.env.APP_ENV ?? 'development';

if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: appEnv,
  });
}

function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <RootNavigator />
        <StatusBar style="light" />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default withOptionalSentryWrap(App, sentryDsn);
