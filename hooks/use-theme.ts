import { Colors, Fonts, FontSize, FontWeight, LineHeight, Radius, Shadows, Spacing } from '@/constants/theme';
import { useThemePreference } from '@/context/theme-preference';

export function useTheme() {
  const { effectiveScheme: scheme } = useThemePreference();
  return {
    colors: Colors[scheme],
    fonts: Fonts,
    fontSize: FontSize,
    fontWeight: FontWeight,
    lineHeight: LineHeight,
    radius: Radius,
    shadows: Shadows,
    spacing: Spacing,
    isDark: scheme === 'dark',
    scheme,
  };
}
