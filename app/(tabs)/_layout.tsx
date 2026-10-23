import type { Href } from 'expo-router';
import { Tabs, usePathname, useRouter } from 'expo-router';
import { Platform, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { runOnJS } from 'react-native-reanimated';

import { GlassView } from '@/components/glass-view';
import { HapticTab } from '@/components/haptic-tab';
import { TabIcon } from '@/components/ui/tab-icon';
import { Colors } from "@/constants/theme";
import {
  TAB_BASE_H,
  TAB_BOTTOM_PAD,
  TAB_TOP_RADIUS,
  tabBarBaseStyle,
  tabBarIconStyle,
  tabBarItemStyle,
  tabBarLabelStyle,
} from '@/constants/tab-bar';
import { useThemePreference } from '@/context/theme-preference';

const TAB_ROUTES: Href[] = [
  '/',
  '/menu',
  '/videos',
  '/deliveries',
  '/profile',
];

export default function TabLayout() {
  const { effectiveScheme: scheme } = useThemePreference();
  const c = Colors[scheme];
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  // Android gesture navigation leaves an inset of ≤16dp (a button bar is ≥40dp)
  // and needs extra bottom padding.
  const extraBottomPad =
    Platform.OS === "android" && insets.bottom <= 16 ? 8 : 0;

  const currentIdx = TAB_ROUTES.indexOf(pathname as Href);

  function goNext() {
    if (currentIdx >= 0 && currentIdx < TAB_ROUTES.length - 1) {
      router.navigate(TAB_ROUTES[currentIdx + 1]);
    }
  }

  function goPrev() {
    if (currentIdx > 0) {
      router.navigate(TAB_ROUTES[currentIdx - 1]);
    }
  }

  const swipe = Gesture.Pan()
    .activeOffsetX([-25, 25])
    .failOffsetY([-8, 8])
    .onEnd((e) => {
      "worklet";
      if (e.translationX < -60 || e.velocityX < -500) {
        runOnJS(goNext)();
      } else if (e.translationX > 60 || e.velocityX > 500) {
        runOnJS(goPrev)();
      }
    });

  const icon = (name: React.ComponentProps<typeof TabIcon>['name'], focusedName: React.ComponentProps<typeof TabIcon>['focusedName']) =>
    function Icon({ color, focused }: { color: string; focused: boolean }) {
      return <TabIcon name={name} focusedName={focusedName} color={color} focused={focused} pillColor={c.primaryBg} />;
    };

  return (
    <GestureDetector gesture={swipe}>
      {/* Shows through the tab bar's rounded top corners. */}
      <View collapsable={false} style={{ flex: 1, backgroundColor: c.background }}>
        <Tabs
          screenOptions={{
            headerShown: false,
            tabBarButton: HapticTab,
            tabBarActiveTintColor: c.tabBarActive,
            tabBarInactiveTintColor: c.tabBarInactive,
            tabBarBackground:
              Platform.OS === "ios"
                ? () => (
                    <GlassView
                      intensity={80}
                      tint={scheme === "dark" ? "dark" : "light"}
                      style={[StyleSheet.absoluteFill, styles.glass]}
                    />
                  )
                : undefined,
            tabBarStyle: [
              tabBarBaseStyle,
              {
                // Grows by the bottom inset so the icons clear the Android
                // nav bar or the iOS home indicator.
                height:
                  TAB_BASE_H + insets.bottom + TAB_BOTTOM_PAD + extraBottomPad,
                paddingBottom: insets.bottom + TAB_BOTTOM_PAD + extraBottomPad,
                paddingHorizontal: Platform.OS === "ios" ? 8 : 4,
                backgroundColor:
                  Platform.OS === "ios" ? "transparent" : c.tabBar,
                borderTopColor: c.tabBarBorder,
              },
            ],
            tabBarLabelStyle,
            tabBarAllowFontScaling: false,
            tabBarItemStyle,
            tabBarIconStyle,
          }}
        >
          <Tabs.Screen
            name="index"
            options={{ title: "Home", tabBarIcon: icon("home-outline", "home") }}
          />
          <Tabs.Screen
            name="menu"
            options={{ title: "Menu", tabBarIcon: icon("leaf-outline", "leaf") }}
          />
          <Tabs.Screen
            name="videos"
            options={{ title: "Videos", tabBarIcon: icon("play-circle-outline", "play-circle") }}
          />
          <Tabs.Screen
            name="deliveries"
            options={{ title: "Deliveries", tabBarIcon: icon("bicycle-outline", "bicycle") }}
          />
          <Tabs.Screen
            name="profile"
            options={{ title: "Profile", tabBarIcon: icon("person-outline", "person") }}
          />
        </Tabs>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  glass: {
    borderTopLeftRadius: TAB_TOP_RADIUS,
    borderTopRightRadius: TAB_TOP_RADIUS,
    overflow: "hidden",
  },
});
