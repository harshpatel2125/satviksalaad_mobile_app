import React from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';

import { VideoThumbnail } from '@/components/screens/videos/video-thumbnail';
import { SectionHeader } from '@/components/ui/section-header';
import { Text } from '@/components/ui/text';
import { CardEdge, FontSize, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { categoryLabel, useVideos } from '@/lib/videos';
import type { Video } from '@/types/api';

const MAX_VIDEOS = 6;
const CARD_WIDTH = 236;

interface Props {
  onOpen: (video: Video) => void;
  onSeeAll: () => void;
}

/** "Watch & learn" row; renders nothing until there is something to show. */
export function VideoStrip({ onOpen, onSeeAll }: Props) {
  const { colors, fonts } = useTheme();
  const { data } = useVideos();

  const categories = data?.data?.categories ?? [];
  const all = data?.data?.videos ?? [];
  const videos = [...all.filter((v) => v.isFeatured), ...all.filter((v) => !v.isFeatured)].slice(0, MAX_VIDEOS);
  if (videos.length === 0) return null;

  return (
    <View style={s.section}>
      <SectionHeader label="Watch & learn" action="See all" onAction={onSeeAll} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        // Bleeds to the screen edges so cards scroll under the page gutter.
        style={s.bleed}
        contentContainerStyle={s.row}
      >
        {videos.map((video) => (
          <TouchableOpacity
            key={video.id}
            activeOpacity={0.85}
            onPress={() => onOpen(video)}
            style={[s.card, { backgroundColor: colors.surface, borderWidth: 0 }, CardEdge]}
          >
            <VideoThumbnail video={video} radius={0} />
            <View style={s.body}>
              <Text style={[s.category, { color: colors.primary, fontFamily: fonts.bodySemibold }]}>
                {categoryLabel(categories, video.category).toUpperCase()}
              </Text>
              <Text style={[s.title, { color: colors.text, fontFamily: fonts.bodySemibold }]} numberOfLines={2}>
                {video.title}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  section: { gap: Spacing[2] },
  bleed: { marginHorizontal: -Spacing[5] },
  row: { paddingHorizontal: Spacing[5], gap: Spacing[3] },
  card: {
    width: CARD_WIDTH,
    borderRadius: Radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  body: { padding: Spacing[3], gap: 2 },
  category: { fontSize: 9, letterSpacing: 0.8 },
  title: { fontSize: FontSize.sm },
});
