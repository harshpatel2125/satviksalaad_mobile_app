import { useQuery } from '@tanstack/react-query';

import { videosApi } from '@/lib/api';
import { resolveImageUrl } from '@/lib/image-url';
import { asyncPersister, CACHE_TTL } from '@/lib/query-client';
import type { Video, VideoCategory } from '@/types/api';

export const VIDEOS_QUERY_KEY = ['videos'] as const;

export function useVideos() {
  return useQuery({
    queryKey: VIDEOS_QUERY_KEY,
    queryFn: videosApi.list,
    staleTime: CACHE_TTL.videos,
    persister: asyncPersister.persisterFn,
  });
}

/** "4:05", or "1:02:09" past the hour; null when the length is unknown. */
export function formatDuration(seconds: number | null | undefined): string | null {
  if (!seconds || seconds <= 0) return null;
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

export function videoThumbnail(video: Video): string | null {
  return (
    resolveImageUrl(video.thumbnailUrl) ??
    (video.youtubeId ? `https://i.ytimg.com/vi/${video.youtubeId}/hqdefault.jpg` : null)
  );
}

/** Absolute URL of an uploaded video file; null for YouTube videos. */
export function videoPlaybackUrl(video: Video): string | null {
  return video.source === 'upload' ? resolveImageUrl(video.videoUrl) : null;
}

export function isPortrait(video: Video): boolean {
  return video.orientation === 'portrait';
}

export function youtubeWatchUrl(youtubeId: string): string {
  return `https://www.youtube.com/watch?v=${youtubeId}`;
}

export function categoryLabel(categories: VideoCategory[], id: string): string {
  return categories.find((c) => c.id === id)?.label ?? id.charAt(0).toUpperCase() + id.slice(1);
}
