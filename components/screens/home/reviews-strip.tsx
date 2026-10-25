import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import React, { useState } from 'react';
import { Linking, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { CardEdge, FontSize, LineHeight, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { reviewsApi } from '@/lib/api';
import { asyncPersister, CACHE_TTL } from '@/lib/query-client';
import type { CustomerReview } from '@/types/api';

const CARD_WIDTH = 264;
const CLAMPED_LINES = 5;

/** The Google rating and the five-star reviews the team has added; nothing until there are some. */
export function ReviewsStrip() {
  const { colors, fonts } = useTheme();
  const { data } = useQuery({
    queryKey: ['reviews'],
    queryFn: reviewsApi.get,
    staleTime: CACHE_TTL.menu,
    persister: asyncPersister.persisterFn,
  });
  const reviews = data?.data;
  if (!reviews || reviews.reviews.length === 0) return null;

  const summary = [
    reviews.rating ? `${reviews.rating}★` : null,
    reviews.count ? `${reviews.count} Google reviews` : 'Google reviews',
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={s.root}>
      <View style={s.head}>
        <Text style={[s.title, { color: colors.text, fontFamily: fonts.display }]}>Loved across Ahmedabad</Text>
        {reviews.url ? (
          <TouchableOpacity
            onPress={() => void Linking.openURL(reviews.url!)}
            hitSlop={8}
            accessibilityRole="link"
            style={s.summary}
          >
            <Text style={[s.summaryText, { color: colors.primary, fontFamily: fonts.bodySemibold }]}>{summary}</Text>
            <Ionicons name="open-outline" size={13} color={colors.primary} />
          </TouchableOpacity>
        ) : (
          <Text style={[s.summaryText, { color: colors.textMuted, fontFamily: fonts.bodySemibold }]}>{summary}</Text>
        )}
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={CARD_WIDTH + Spacing[3]}
        decelerationRate="fast"
        contentContainerStyle={s.row}
      >
        {reviews.reviews.map((review) => (
          <ReviewCard key={review.id} review={review} />
        ))}
      </ScrollView>
    </View>
  );
}

function ReviewCard({ review }: { review: CustomerReview }) {
  const { colors, fonts } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const [clamped, setClamped] = useState(false);

  return (
    <View style={[s.card, { backgroundColor: colors.surface }, CardEdge]}>
      <View style={s.stars} accessibilityLabel={`${review.stars} stars`}>
        {Array.from({ length: review.stars }, (_, i) => (
          <Ionicons key={i} name="star" size={13} color={colors.accent} />
        ))}
      </View>
      {review.text ? (
        <>
          <Text
            numberOfLines={expanded ? undefined : CLAMPED_LINES}
            onTextLayout={(e) => {
              if (!expanded) setClamped(e.nativeEvent.lines.length >= CLAMPED_LINES);
            }}
            style={[s.text, { color: colors.textSecondary, fontFamily: fonts.body }]}
          >
            {review.text}
          </Text>
          {clamped ? (
            <TouchableOpacity onPress={() => setExpanded((v) => !v)} hitSlop={8} accessibilityRole="button">
              <Text style={[s.more, { color: colors.primary, fontFamily: fonts.bodySemibold }]}>
                {expanded ? 'Show less' : 'Read more'}
              </Text>
            </TouchableOpacity>
          ) : null}
        </>
      ) : (
        <Text style={[s.text, { color: colors.textMuted, fontFamily: fonts.body }]}>
          Rated {review.stars} stars on Google
        </Text>
      )}
      <Text style={[s.name, { color: colors.text, fontFamily: fonts.bodySemibold }]}>
        {review.name}
        {review.when ? (
          <Text style={{ color: colors.textMuted, fontFamily: fonts.body }}> · {review.when}</Text>
        ) : null}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { gap: Spacing[3] },
  head: { paddingHorizontal: Spacing[5], gap: 2 },
  title: { fontSize: FontSize.xl },
  summary: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' },
  summaryText: { fontSize: FontSize.sm },
  row: { paddingHorizontal: Spacing[5], gap: Spacing[3] },
  card: { width: CARD_WIDTH, borderRadius: Radius.lg, padding: Spacing[4], gap: Spacing[2] },
  stars: { flexDirection: 'row', gap: 2 },
  text: { fontSize: FontSize.sm, lineHeight: FontSize.sm * LineHeight.normal },
  more: { fontSize: FontSize.xs },
  name: { fontSize: FontSize.sm, marginTop: 'auto' },
});
