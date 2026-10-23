import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { Text } from '@/components/ui/text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatDuration, isPortrait, videoThumbnail } from '@/lib/videos';
import type { Video } from '@/types/api';

interface Props {
  video: Video;
  size?: 'regular' | 'large';
  radius?: number;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

const SOURCE_BADGE = {
  youtube: { icon: 'logo-youtube', label: 'YouTube' },
  instagram: { icon: 'logo-instagram', label: 'Instagram' },
} as const;

/**
 * 16:9 artwork with a play button, duration and a source marker. A portrait
 * poster is shown whole over a blurred copy of itself rather than cropped to a
 * thin strip.
 */
export function VideoThumbnail({ video, size = 'regular', radius = Radius.lg, style, children }: Props) {
  const { colors, fonts } = useTheme();
  const uri = videoThumbnail(video);
  const duration = formatDuration(video.durationSeconds);
  const play = size === 'large' ? 58 : 44;
  const badge = video.source === 'upload' ? null : SOURCE_BADGE[video.source];

  return (
    <View style={[s.frame, { borderRadius: radius, backgroundColor: colors.primaryBg }, style]}>
      {uri && isPortrait(video) ? (
        <>
          <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={24} />
          <View style={[StyleSheet.absoluteFill, s.dim]} />
          <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="contain" transition={200} />
        </>
      ) : uri ? (
        <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
      ) : (
        <LinearGradient colors={[colors.primaryBg, colors.accentBg]} style={StyleSheet.absoluteFill}>
          <Ionicons name="leaf" size={size === 'large' ? 150 : 110} color={colors.primary} style={s.watermark} />
        </LinearGradient>
      )}

      {children}

      <View style={[StyleSheet.absoluteFill, s.center]} pointerEvents="none">
        <View style={[s.play, { width: play, height: play, borderRadius: play / 2 }]}>
          <Ionicons name="play" size={play * 0.45} color="#fff" style={{ marginLeft: play * 0.06 }} />
        </View>
      </View>

      {badge ? (
        <View style={[s.badge, s.topLeft]}>
          <Ionicons name={badge.icon} size={12} color="#fff" />
          <Text style={[s.badgeText, { fontFamily: fonts.bodySemibold }]}>{badge.label}</Text>
        </View>
      ) : null}

      {duration ? (
        <View style={[s.badge, s.bottomRight]}>
          <Text style={[s.badgeText, { fontFamily: fonts.bodySemibold }]}>{duration}</Text>
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  frame: {
    width: '100%',
    aspectRatio: 16 / 9,
    overflow: 'hidden',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  dim: { backgroundColor: 'rgba(0,0,0,0.25)' },
  watermark: {
    position: 'absolute',
    right: -18,
    bottom: -22,
    opacity: 0.12,
    transform: [{ rotate: '-18deg' }],
  },
  play: {
    backgroundColor: 'rgba(15,42,26,0.55)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: Radius.sm,
    backgroundColor: 'rgba(0,0,0,0.62)',
  },
  topLeft: { top: 8, left: 8 },
  bottomRight: { bottom: 8, right: 8 },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    letterSpacing: 0.2,
  },
});
