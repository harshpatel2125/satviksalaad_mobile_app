import React from 'react';
import { Platform, StyleSheet, Text as RNText, TextProps, TextStyle } from 'react-native';
import type { TextInstance } from 'react-native';

import { Fonts } from '@/constants/theme';

/**
 * Custom fonts ship one file per weight, and a fontWeight alone never reaches
 * them: React Native would fall back to the system font. Text without a
 * fontFamily therefore gets the body file for its weight.
 */
function bodyFontFor(weight: TextStyle['fontWeight']): string {
  switch (String(weight ?? '400')) {
    case '500':
      return Fonts.bodyMedium;
    case '600':
      return Fonts.bodySemibold;
    case '700':
    case '800':
    case '900':
    case 'bold':
      return Fonts.bodyBold;
    default:
      return Fonts.body;
  }
}

// Descender clipping with custom fonts: Android sizes the text box to exactly
// fontSize, so g, p, y … get clipped; a 1.35× lineHeight makes it tall enough.
// iOS splits extra leading evenly, leaving almost no room below the baseline;
// 1.25× clears it. Styles that already set lineHeight are left untouched.
export const Text = React.forwardRef<TextInstance, TextProps>(
  ({ style, ...props }, ref) => {
    const flat = StyleSheet.flatten(style);
    const extra: { fontFamily?: string; fontWeight?: TextStyle['fontWeight']; lineHeight?: number } = {};
    if (!flat?.fontFamily) {
      extra.fontFamily = bodyFontFor(flat?.fontWeight);
      // The weight is in the file; also asking for bold would make Android
      // embolden it a second time.
      extra.fontWeight = 'normal';
    }
    const fontSize = typeof flat?.fontSize === 'number' ? flat.fontSize : null;
    if (fontSize !== null && flat?.lineHeight == null) {
      extra.lineHeight = Math.ceil(fontSize * (Platform.OS === 'android' ? 1.35 : 1.25));
    }
    return <RNText ref={ref} style={[style, extra]} {...props} />;
  },
);

Text.displayName = 'Text';
