// Tab bar metrics. Values only: no component and no navigator config.
import { Platform, StyleSheet } from 'react-native';

import { Fonts, FontSize } from './theme';

/** Icon edge length. React Navigation's default is 26, which reads too heavy. */
export const TAB_ICON_SIZE = 22;

/** The indicator pill drawn behind the active tab's icon. */
export const TAB_PILL = { width: 56, height: 30 } as const;

/**
 * Content height before the bottom safe area is added, so the visible
 * icon-and-label block is the same on every device.
 */
export const TAB_BASE_H = Platform.OS === 'ios' ? 62 : 66;

/**
 * Breathing room between the labels and the system bar, on top of the bottom
 * safe area. Labels sitting inside the home indicator band get cut by the
 * rounded corners of recent iPhones, so iOS keeps a little room too.
 */
export const TAB_BOTTOM_PAD = Platform.OS === 'ios' ? 2 : 10;

export const TAB_TOP_RADIUS = 22;

/** Width the tabs spread across on tablets. */
export const TAB_BAR_MAX_WIDTH = 640;

export const tabBarBaseStyle = {
  borderTopWidth: StyleSheet.hairlineWidth,
  paddingTop: 6,
  borderTopLeftRadius: TAB_TOP_RADIUS,
  borderTopRightRadius: TAB_TOP_RADIUS,
  elevation: 0,
  shadowOpacity: 0,
} as const;

export const tabBarLabelStyle = {
  fontSize: FontSize.xs,
  fontFamily: Fonts.bodySemibold,
  marginTop: 4,
} as const;

export const tabBarItemStyle = {
  paddingTop: 2,
} as const;

export const tabBarIconStyle = {
  width: TAB_PILL.width,
  height: TAB_PILL.height,
} as const;
