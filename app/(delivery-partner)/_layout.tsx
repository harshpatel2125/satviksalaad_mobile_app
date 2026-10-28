import { Tabs } from 'expo-router';
import { useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TabIcon } from '@/components/ui/tab-icon';
import { Colors } from '@/constants/theme';
import {
  TAB_BAR_MAX_WIDTH,
  TAB_BASE_H,
  TAB_BOTTOM_PAD,
  tabBarBaseStyle,
  tabBarIconStyle,
  tabBarItemStyle,
  tabBarLabelStyle,
} from '@/constants/tab-bar';
import { useThemePreference } from '@/context/theme-preference';

export default function DeliveryPartnerLayout() {
  const { effectiveScheme: scheme } = useThemePreference();
  const c = Colors[scheme];
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: c.tabBarActive,
          tabBarInactiveTintColor: c.tabBarInactive,
          tabBarStyle: [
            tabBarBaseStyle,
            {
              height: TAB_BASE_H + insets.bottom + TAB_BOTTOM_PAD,
              paddingBottom: insets.bottom + TAB_BOTTOM_PAD,
              paddingHorizontal: Math.max(0, (width - TAB_BAR_MAX_WIDTH) / 2),
              backgroundColor: c.tabBar,
              borderTopColor: c.tabBarBorder,
            },
          ],
          tabBarLabelStyle,
          tabBarLabelPosition: 'below-icon',
          tabBarAllowFontScaling: false,
          tabBarItemStyle,
          tabBarIconStyle,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Deliveries',
            tabBarIcon: ({ color, focused }) => (
              <TabIcon name="bicycle-outline" focusedName="bicycle" color={color} focused={focused} pillColor={c.primaryBg} />
            ),
          }}
        />
        <Tabs.Screen
          name="report"
          options={{
            title: 'My Report',
            tabBarIcon: ({ color, focused }) => (
              <TabIcon name="stats-chart-outline" focusedName="stats-chart" color={color} focused={focused} pillColor={c.primaryBg} />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color, focused }) => (
              <TabIcon name="person-outline" focusedName="person" color={color} focused={focused} pillColor={c.primaryBg} />
            ),
          }}
        />
      </Tabs>
    </View>
  );
}
