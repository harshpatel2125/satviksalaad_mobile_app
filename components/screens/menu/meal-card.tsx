import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from "expo-linear-gradient";
import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from '@/components/ui/text';

import { Brand, FontSize, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { optimizedImageSource } from '@/lib/image-url';

import { DietBadges } from './diet-badges';

export const PHOTO_COMING_SOON = 'Photo coming soon. Our team is working on it.';

interface MealCardProps {
  meal: {
    name: string;
    kcal: number | null;
    protein: number | null;
    imageUrl: string | null;
    dietLabels?: string[];
  };
  showCalories?: boolean;
  showProtein?: boolean;
  onPress: () => void;
}

export function MealCard({ meal, showCalories = true, showProtein = true, onPress }: MealCardProps) {
  const { fonts, isDark } = useTheme();
  const src =
    optimizedImageSource(meal.imageUrl) ?? require("@/assets/images/hero-image.png");

  const hasKcal    = showCalories && (meal.kcal ?? 0) > 0;
  const hasProtein = showProtein  && (meal.protein ?? 0) > 0;

  const gradientColors: [string, string, ...string[]] = isDark
    ? ['transparent', 'transparent', 'rgba(0,0,0,0.01)', 'rgba(0,0,0,0.06)', 'rgba(0,0,0,0.18)', 'rgba(0,0,0,0.38)', 'rgba(0,0,0,0.58)', 'rgba(0,0,0,0.72)']
    : ['transparent', 'transparent', 'rgba(0,0,0,0.01)', 'rgba(0,0,0,0.04)', 'rgba(0,0,0,0.12)', 'rgba(0,0,0,0.28)', 'rgba(0,0,0,0.46)', 'rgba(0,0,0,0.60)'];

  return (
    <TouchableOpacity style={s.wrap} onPress={onPress} activeOpacity={0.92}>
      <Image
        source={src}
        style={StyleSheet.absoluteFillObject}
        contentFit="cover"
        cachePolicy="memory-disk"
        transition={200}
        recyclingKey={meal.imageUrl ?? 'placeholder'}
      />
      <LinearGradient
        colors={gradientColors}
        locations={[0, 0.32, 0.46, 0.57, 0.67, 0.78, 0.90, 1]}
        style={StyleSheet.absoluteFillObject}
      />
      {!meal.imageUrl && (
        <Text style={[s.photoNote, { fontFamily: fonts.body }]}>{PHOTO_COMING_SOON}</Text>
      )}
      <View style={s.info}>
        <DietBadges labels={meal.dietLabels} onImage />
        <Text style={[s.name, { fontFamily: fonts.display }]} numberOfLines={2}>
          {meal.name}
        </Text>
        <View style={s.metaRow}>
          {hasKcal && (
            <Text style={[s.meta, { fontFamily: fonts.body }]}>
              {meal.kcal} kcal
            </Text>
          )}
          {hasKcal && hasProtein && <View style={s.sep} />}
          {hasProtein && (
            <Text style={[s.meta, { fontFamily: fonts.body }]}>
              {meal.protein}g protein
            </Text>
          )}
          <View style={[s.sep, { marginLeft: "auto" }]} />
          <Ionicons
            name="chevron-forward"
            size={13}
            color="rgba(255,255,255,0.6)"
          />
        </View>
      </View>

    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  wrap: { height: 210, borderRadius: Radius["2xl"], overflow: "hidden" },
  photoNote: {
    position: "absolute",
    top: 12,
    left: 16,
    right: 16,
    textAlign: "center",
    fontSize: FontSize.xs,
    color: Brand.forest,
    opacity: 0.7,
  },
  info: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
    gap: 5,
  },
  name: {
    fontSize: FontSize.xl,
    color: "#fff",
    letterSpacing: -0.3,
    lineHeight: FontSize.xl * 1.22,
  },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  sep: {
    width: 3,
    height: 3,
    borderRadius: 99,
    backgroundColor: "rgba(255,255,255,0.45)",
  },
  meta: { fontSize: FontSize.sm, color: "rgba(255,255,255,0.75)" },
});
