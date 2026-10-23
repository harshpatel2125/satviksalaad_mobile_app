import { BASE_URL } from '@/lib/api';

/**
 * The one place an image URL from API data becomes loadable: the backend stores
 * uploads as root-relative paths (`/media/meals/x.webp`), which resolve against
 * the API base. Absolute URLs pass through unchanged.
 */
export function resolveImageUrl(url: string | null | undefined): string | null {
  const trimmed = url?.trim();
  if (!trimmed) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return trimmed;
  if (trimmed.startsWith('//')) return `https:${trimmed}`;
  return `${BASE_URL}${trimmed.startsWith('/') ? '' : '/'}${trimmed}`;
}

/**
 * Image source for a remote URL, for expo-image or React Native's Image.
 * Returns null for a null or empty input so callers keep their local-asset
 * fallback via `??`.
 */
export function optimizedImageSource(url: string | null | undefined): { uri: string } | null {
  const uri = resolveImageUrl(url);
  return uri ? { uri } : null;
}

/** Resolves a list of image URLs for `Image.prefetch`, dropping empty entries. */
export function optimizedImageUrls(urls: (string | null | undefined)[]): string[] {
  return urls.map(resolveImageUrl).filter((u): u is string => u !== null);
}
