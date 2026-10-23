import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { TAB_ICON_SIZE, TAB_PILL } from '@/constants/tab-bar';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

/**
 * React Navigation renders a tab's icon twice, focused and unfocused, and
 * cross-fades the two; the pill lives in the focused copy, so it shows only
 * on the active tab.
 */
export function TabIcon({
  name,
  focusedName,
  color,
  focused,
  pillColor,
}: {
  name: IoniconName;
  focusedName: IoniconName;
  color: string;
  focused: boolean;
  pillColor: string;
}) {
  return (
    <View style={[s.pill, focused && { backgroundColor: pillColor }]}>
      <Ionicons name={focused ? focusedName : name} size={TAB_ICON_SIZE} color={color} />
    </View>
  );
}

const s = StyleSheet.create({
  pill: {
    width: TAB_PILL.width,
    height: TAB_PILL.height,
    borderRadius: TAB_PILL.height / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
