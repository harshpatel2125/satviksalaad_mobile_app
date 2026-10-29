import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FeaturedVideoCard, VideoCard } from '@/components/screens/videos/video-card';
import { VideosSkeleton } from '@/components/skeletons/videos-skeleton';
import { Text } from '@/components/ui/text';
import { EmptyState } from '@/components/ui/empty-state';
import { ScreenHeader } from '@/components/ui/screen-header';
import { column, columnsFor, WIDE_WIDTH } from '@/constants/layout';
import { FontSize, Radius, Spacing } from '@/constants/theme';
import { useQueryFocusRefetch } from '@/hooks/useQueryFocusRefetch';
import { useTheme } from '@/hooks/use-theme';
import { categoryLabel, useVideos, VIDEOS_QUERY_KEY } from '@/lib/videos';
import type { Video } from '@/types/api';

type Filter = 'all' | Video['category'];

export default function VideosScreen() {
  const { colors, fonts } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const listWidth = Math.min(width, WIDE_WIDTH) - Spacing[5] * 2;
  const videoColumns = columnsFor(listWidth, 300, Spacing[4], 3);
  const videoWidth = (listWidth - Spacing[4] * (videoColumns - 1)) / videoColumns;
  const { category } = useLocalSearchParams<{ category?: string }>();
  // An unknown category falls back to 'all' below, once the categories load.
  const [filter, setFilter] = useState<Filter>(() => (category as Filter | undefined) ?? 'all');
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading, isError, refetch } = useVideos();
  useQueryFocusRefetch(VIDEOS_QUERY_KEY);

  const categories = useMemo(() => data?.data?.categories ?? [], [data]);
  const videos = useMemo(() => data?.data?.videos ?? [], [data]);

  const activeFilter: Filter =
    filter === 'all' || categories.some((c) => c.id === filter) ? filter : 'all';
  const featured = activeFilter === 'all' ? videos.find((v) => v.isFeatured) ?? null : null;
  const list = videos.filter(
    (v) => v !== featured && (activeFilter === 'all' || v.category === activeFilter),
  );

  function open(video: Video) {
    router.push({ pathname: '/video-player', params: { id: video.id } });
  }

  async function handleRefresh() {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }

  const chips: { id: Filter; label: string }[] = [{ id: 'all', label: 'All' }, ...categories];

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <ScreenHeader
        title="Videos"
        subtitle="Eat well · Move well"
        maxWidth={WIDE_WIDTH}
        onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      />

      {categories.length > 1 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.chips}
          style={[s.chipsBar, column(WIDE_WIDTH)]}
        >
          {chips.map((chip) => {
            const active = chip.id === activeFilter;
            return (
              <TouchableOpacity
                key={chip.id}
                onPress={() => setFilter(chip.id)}
                activeOpacity={0.8}
                style={[
                  s.chip,
                  active
                    ? { backgroundColor: colors.primary, borderColor: colors.primary }
                    : { backgroundColor: colors.surface2, borderColor: 'transparent' },
                ]}
              >
                <Text
                  style={[
                    s.chipText,
                    {
                      color: active ? colors.textOnPrimary : colors.textSecondary,
                      fontFamily: active ? fonts.bodySemibold : fonts.bodyMedium,
                    },
                  ]}
                >
                  {chip.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      ) : null}

      {isLoading && !data ? (
        <ScrollView showsVerticalScrollIndicator={false}>
          <VideosSkeleton />
        </ScrollView>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[column(WIDE_WIDTH), s.scroll, { paddingBottom: insets.bottom + Spacing[6] }]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void handleRefresh()}
              tintColor={colors.primary}
            />
          }
        >
          {featured ? (
            <Animated.View entering={FadeIn.duration(250)}>
              <FeaturedVideoCard
                video={featured}
                categoryLabel={categoryLabel(categories, featured.category)}
                onPress={() => open(featured)}
              />
            </Animated.View>
          ) : null}

          {!featured && list.length === 0 ? (
            <EmptyState
              icon={isError ? 'cloud-offline-outline' : 'play-circle-outline'}
              title={isError ? "Couldn't load videos" : 'No videos yet'}
              body={isError ? 'Pull down to try again.' : 'Fresh yoga, fitness and nutrition videos are on the way.'}
            />
          ) : (
            <View style={s.grid}>
              {list.map((video) => (
                <View key={video.id} style={{ width: videoWidth }}>
                  <VideoCard
                    video={video}
                    categoryLabel={categoryLabel(categories, video.category)}
                    onPress={() => open(video)}
                  />
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  // ScrollView shrinks by default, which lets the list below squeeze the chips.
  chipsBar: { flexGrow: 0, flexShrink: 0 },
  chips: {
    paddingHorizontal: Spacing[5],
    paddingBottom: Spacing[3],
    gap: Spacing[2],
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  chipText: { fontSize: FontSize.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing[4] },
  scroll: {
    paddingTop: Spacing[1],
    paddingHorizontal: Spacing[5],
    paddingBottom: Spacing[6],
    gap: Spacing[4],
  },
});
