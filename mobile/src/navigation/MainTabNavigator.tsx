import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Platform, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HomeStackNavigator } from './HomeStackNavigator';
import { EventsStackNavigator } from './EventsStackNavigator';
import { TAB_BAR_CONTENT_HEIGHT } from '../constants/layout';
import { authColors } from '../theme/colors';
import type { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  return (
    <Text style={[styles.tabIcon, focused && styles.tabIconFocused]} accessibilityElementsHidden>
      {label}
    </Text>
  );
}

export function MainTabNavigator() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = TAB_BAR_CONTENT_HEIGHT + insets.bottom;

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: authColors.textOnDark,
        tabBarInactiveTintColor: authColors.textOnDarkMuted,
        tabBarStyle: {
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(11, 61, 69, 0.94)',
          borderTopColor: authColors.glassBorder,
          borderTopWidth: 1,
          height: tabBarHeight,
          paddingTop: 8,
          paddingBottom: Math.max(insets.bottom, Platform.OS === 'android' ? 8 : 0),
          elevation: 12,
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.25,
          shadowRadius: 12,
        },
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeStackNavigator}
        options={{
          tabBarLabel: 'Dashboard',
          tabBarIcon: ({ focused }) => <TabIcon label="⬡" focused={focused} />,
        }}
        listeners={({ navigation }) => ({
          tabPress: () => {
            navigation.navigate('HomeTab', { screen: 'Home' });
          },
        })}
      />
      <Tab.Screen
        name="EventsTab"
        component={EventsStackNavigator}
        options={{
          tabBarLabel: 'Events',
          tabBarIcon: ({ focused }) => <TabIcon label="☰" focused={focused} />,
        }}
        listeners={({ navigation }) => ({
          tabPress: () => {
            navigation.navigate('EventsTab', { screen: 'Events' });
          },
        })}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.2,
    marginBottom: 2,
  },
  tabIcon: {
    fontSize: 22,
    color: authColors.textOnDarkMuted,
  },
  tabIconFocused: {
    color: authColors.textOnDark,
    transform: [{ scale: 1.08 }],
  },
});
