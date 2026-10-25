import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from '@/components/ui/text';

import { Brand, CardEdge, FontSize, Radius, Spacing } from '@/constants/theme';
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
  /** Card width, so a grid can size its columns. */
  width: number;
  showCalories?: boolean;
  showProtein?: boolean;
  onPress: () => void;
}

/** One menu item as a small grid card: photo, name, nutrition and diet marks. */
export function MealCard({ meal, width, showCalories = true, showProtein = true, onPress }: MealCardProps) {
  const { colors, fonts } = useTheme();
  const photo = optimizedImageSource(meal.imageUrl);
  const facts = [
    showCalories && (meal.kcal ?? 0) > 0 ? `${meal.kcal} kcal` : null,
    showProtein && (meal.protein ?? 0) > 0 ? `${meal.protein} g protein` : null,
  ].filter(Boolean);

  return (
    <TouchableOpacity
      style={[s.card, { width, backgroundColor: colors.surface }, CardEdge]}
      onPress={onPress}
      activeOpacity={0.9}
      accessibilityRole="button"
      accessibilityLabel={meal.name}
    >
      <View style={[s.photo, { backgroundColor: Brand.sageLight }]}>
        {photo ? (
          <Image
            source={photo}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={200}
            recyclingKey={meal.imageUrl ?? undefined}
          />
        ) : (
          <>
            <Image source={require('@/assets/images/hero-image.png')} style={StyleSheet.absoluteFill} contentFit="cover" />
            <Text style={[s.photoNote, { fontFamily: fonts.body }]}>Photo coming soon</Text>
          </>
        )}
      </View>
      <View style={s.body}>
        <Text style={[s.name, { color: colors.text, fontFamily: fonts.bodySemibold }]} numberOfLines={2}>
          {meal.name}
        </Text>
        {facts.length > 0 ? (
          <Text style={[s.facts, { color: colors.primary, fontFamily: fonts.bodyMedium }]} numberOfLines={1}>
            {facts.join(' · ')}
          </Text>
        ) : null}
        <DietBadges labels={meal.dietLabels} />
      </View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  card: { borderRadius: Radius.lg, overflow: 'hidden' },
  photo: { width: '100%', aspectRatio: 4 / 3 },
  photoNote: {
    position: 'absolute',
    bottom: 6,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 10,
    color: Brand.forest,
    opacity: 0.7,
  },
  body: { padding: Spacing[2.5], gap: 4 },
  name: { fontSize: FontSize.sm, lineHeight: FontSize.sm * 1.3 },
  facts: { fontSize: FontSize.xs },
});
