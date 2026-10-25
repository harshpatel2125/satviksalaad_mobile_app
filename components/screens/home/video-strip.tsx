import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';

import { SectionHeader } from '@/components/ui/section-header';
import { Text } from '@/components/ui/text';
import { FontSize, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useVideos, videoThumbnail } from '@/lib/videos';
import type { Video } from '@/types/api';

const MAX_VIDEOS = 8;
const CARD_WIDTH = 148;

const SOURCE: Record<Video['source'], { label: string; icon: React.ComponentProps<typeof Ionicons>['name'] | null }> = {
  instagram: { label: 'Reel', icon: 'logo-instagram' },
  youtube: { label: 'YouTube', icon: 'logo-youtube' },
  upload: { label: 'Video', icon: null },
};

interface Props {
  onOpen: (video: Video) => void;
  onSeeAll: () => void;
}

/** Reels-style row of tall cards, as on the website; renders nothing until there is something to show. */
export function VideoStrip({ onOpen, onSeeAll }: Props) {
  const { colors, fonts } = useTheme();
  const { data } = useVideos();

  const all = data?.data?.videos ?? [];
  const videos = [...all.filter((v) => v.isFeatured), ...all.filter((v) => !v.isFeatured)].slice(0, MAX_VIDEOS);
  if (videos.length === 0) return null;

  return (
    <View style={s.section}>
      <SectionHeader label="From our kitchen" action="All videos" onAction={onSeeAll} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={CARD_WIDTH + Spacing[3]}
        decelerationRate="fast"
        // Bleeds to the screen edges so cards scroll under the page gutter.
        style={s.bleed}
        contentContainerStyle={s.row}
      >
        {videos.map((video) => {
          const uri = videoThumbnail(video);
          const source = SOURCE[video.source];
          return (
            <TouchableOpacity
              key={video.id}
              activeOpacity={0.88}
              onPress={() => onOpen(video)}
              accessibilityRole="button"
              accessibilityLabel={`Play ${video.title}`}
              style={[s.card, { backgroundColor: colors.primary }]}
            >
              {uri ? <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} /> : null}
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.15)', 'rgba(0,0,0,0.8)']}
                locations={[0.35, 0.55, 1]}
                style={StyleSheet.absoluteFill}
              />
              <View style={s.play}>
                <Ionicons name="play" size={13} color={colors.primary} style={s.playIcon} />
              </View>
              <View style={s.caption}>
                <View style={s.sourceRow}>
                  {source.icon ? <Ionicons name={source.icon} size={11} color="rgba(255,255,255,0.8)" /> : null}
                  <Text style={[s.sourceText, { fontFamily: fonts.bodySemibold }]}>{source.label.toUpperCase()}</Text>
                </View>
                <Text style={[s.title, { fontFamily: fonts.bodySemibold }]} numberOfLines={3}>
                  {video.title}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  section: { gap: Spacing[2] },
  bleed: { marginHorizontal: -Spacing[5] },
  row: { paddingHorizontal: Spacing[5], gap: Spacing[3] },
  card: { width: CARD_WIDTH, aspectRatio: 9 / 16, borderRadius: Radius.lg, overflow: 'hidden' },
  play: {
    position: 'absolute',
    top: 10,
    left: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playIcon: { marginLeft: 2 },
  caption: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 10, gap: 3 },
  sourceRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sourceText: { fontSize: 10, letterSpacing: 0.8, color: 'rgba(255,255,255,0.8)' },
  title: { fontSize: FontSize.sm, lineHeight: FontSize.sm * 1.3, color: '#fff' },
});
