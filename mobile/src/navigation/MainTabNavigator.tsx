import { useEffect } from 'react';
import { CommonActions } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StyleSheet, Text } from 'react-native';
import { useNotificationStore } from '../store/notificationStore';
import { TAB_BAR_CONTENT_HEIGHT, TAB_BAR_PADDING_TOP } from '../constants/layout';
import { useAppInsets } from '../hooks/useAppInsets';
import { HomeStackNavigator } from './HomeStackNavigator';
import { EventsStackNavigator } from './EventsStackNavigator';
import { SettingsStackNavigator } from './SettingsStackNavigator';
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
  const { tabBarPaddingBottom } = useAppInsets();
  const tabBarHeight = TAB_BAR_PADDING_TOP + TAB_BAR_CONTENT_HEIGHT + tabBarPaddingBottom;
  const loadUnreadCount = useNotificationStore((state) => state.loadUnreadCount);

  useEffect(() => {
    void loadUnreadCount();
  }, [loadUnreadCount]);

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
          backgroundColor: 'rgba(11, 61, 69, 0.92)',
          borderTopColor: 'rgba(255, 255, 255, 0.12)',
          borderTopWidth: StyleSheet.hairlineWidth,
          height: tabBarHeight,
          paddingTop: TAB_BAR_PADDING_TOP,
          paddingBottom: tabBarPaddingBottom,
          elevation: 8,
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.18,
          shadowRadius: 8,
        },
        tabBarItemStyle: styles.tabItem,
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
          tabPress: (e) => {
            e.preventDefault();
            const state = navigation.getState();
            const homeTabRoute = state.routes.find((route) => route.name === 'HomeTab');
            const homeStackKey = homeTabRoute?.state?.key;
            const homeStackIndex = homeTabRoute?.state?.index ?? 0;
            if (homeStackKey && homeStackIndex > 0) {
              navigation.dispatch({
                ...CommonActions.reset({
                  index: 0,
                  routes: [{ name: 'Home' }],
                }),
                target: homeStackKey,
              });
            }
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
          tabPress: (e) => {
            e.preventDefault();
            const state = navigation.getState();
            const eventsTabRoute = state.routes.find((route) => route.name === 'EventsTab');
            const eventsStackKey = eventsTabRoute?.state?.key;
            const eventsStackIndex = eventsTabRoute?.state?.index ?? 0;
            if (eventsStackKey && eventsStackIndex > 0) {
              navigation.dispatch({
                ...CommonActions.reset({
                  index: 0,
                  routes: [{ name: 'Events' }],
                }),
                target: eventsStackKey,
              });
            }
            navigation.navigate('EventsTab', { screen: 'Events' });
          },
        })}
      />
      <Tab.Screen
        name="SettingsTab"
        component={SettingsStackNavigator}
        options={{
          tabBarLabel: 'Settings',
          tabBarIcon: ({ focused }) => <TabIcon label="⚙" focused={focused} />,
        }}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            e.preventDefault();
            const state = navigation.getState();
            const settingsTabRoute = state.routes.find((route) => route.name === 'SettingsTab');
            const settingsStackKey = settingsTabRoute?.state?.key;
            const settingsStackIndex = settingsTabRoute?.state?.index ?? 0;
            if (settingsStackKey && settingsStackIndex > 0) {
              navigation.dispatch({
                ...CommonActions.reset({
                  index: 0,
                  routes: [{ name: 'Settings' }],
                }),
                target: settingsStackKey,
              });
            }
            navigation.navigate('SettingsTab', { screen: 'Settings' });
          },
        })}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabItem: {
    paddingTop: 0,
    paddingBottom: 0,
    minHeight: TAB_BAR_CONTENT_HEIGHT,
    justifyContent: 'center',
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.2,
    marginTop: 2,
    marginBottom: 0,
  },
  tabIcon: {
    fontSize: 18,
    color: authColors.textOnDarkMuted,
    lineHeight: 20,
  },
  tabIconFocused: {
    color: authColors.textOnDark,
  },
});
