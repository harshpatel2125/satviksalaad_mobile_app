import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { CardEdge, FontSize, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Video } from '@/types/api';

import { VideoThumbnail } from './video-thumbnail';

interface Props {
  video: Video;
  categoryLabel: string;
  onPress: () => void;
}

export function VideoCard({ video, categoryLabel, onPress }: Props) {
  const { colors, fonts } = useTheme();
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={[s.card, { backgroundColor: colors.surface, borderWidth: 0 }, CardEdge]}
    >
      <VideoThumbnail video={video} radius={0} />
      <View style={s.body}>
        <Text style={[s.category, { color: colors.primary, fontFamily: fonts.bodySemibold }]}>
          {categoryLabel.toUpperCase()}
        </Text>
        <Text style={[s.title, { color: colors.text, fontFamily: fonts.bodySemibold }]} numberOfLines={2}>
          {video.title}
        </Text>
        {video.description ? (
          <Text style={[s.description, { color: colors.textMuted, fontFamily: fonts.body }]} numberOfLines={2}>
            {video.description}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

/** Full-width hero card for the featured video, title laid over the artwork. */
export function FeaturedVideoCard({ video, categoryLabel, onPress }: Props) {
  const { colors, fonts } = useTheme();
  return (
    <TouchableOpacity activeOpacity={0.9} onPress={onPress}>
      <VideoThumbnail video={video} size="large" radius={Radius['2xl']}>
        <LinearGradient
          colors={['transparent', 'rgba(20,8,2,0.85)']}
          locations={[0.35, 1]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <View style={s.featuredText} pointerEvents="none">
          <View style={[s.featuredChip, { backgroundColor: colors.primary }]}>
            <Text style={[s.featuredChipText, { fontFamily: fonts.bodyBold }]}>
              FEATURED · {categoryLabel.toUpperCase()}
            </Text>
          </View>
          <Text style={[s.featuredTitle, { fontFamily: fonts.display }]} numberOfLines={2}>
            {video.title}
          </Text>
        </View>
      </VideoThumbnail>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  card: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    overflow: 'hidden',
  },
  body: {
    padding: Spacing[4],
    gap: 4,
  },
  category: {
    fontSize: 10,
    letterSpacing: 0.8,
  },
  title: {
    fontSize: FontSize.md,
  },
  description: {
    fontSize: FontSize.sm,
  },
  featuredText: {
    position: 'absolute',
    left: Spacing[4],
    right: Spacing[4],
    bottom: Spacing[4],
    gap: 8,
  },
  featuredChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  featuredChipText: {
    color: '#fff',
    fontSize: 9,
    letterSpacing: 0.8,
  },
  featuredTitle: {
    color: '#fff',
    fontSize: FontSize.xl,
  },
});
