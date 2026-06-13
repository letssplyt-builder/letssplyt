import { CommonActions } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StyleSheet, Text } from 'react-native';
import { TAB_BAR_CONTENT_HEIGHT, TAB_BAR_PADDING_TOP } from '../constants/layout';
import { useAppInsets } from '../hooks/useAppInsets';
import { HomeStackNavigator } from './HomeStackNavigator';
import { EventsStackNavigator } from './EventsStackNavigator';
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
            navigation.navigate('EventsTab', { screen: 'Events' });
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
