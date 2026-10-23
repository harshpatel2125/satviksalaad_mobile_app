export const DEEP_LINK_BASE = 'https://www.satviksalaad.in/app';

/**
 * Converts an incoming deep link URL to an Expo Router path.
 * Returns null for sign-in callbacks and unrecognised URLs.
 */
export function parseIncomingUrl(url: string): string | null {
  if (url.includes('/auth/callback')) return null;

  if (url.startsWith(DEEP_LINK_BASE)) {
    const path = url.slice(DEEP_LINK_BASE.length);
    return path.startsWith('/') ? path : `/${path}`;
  }

  if (url.startsWith('satviksalaad://')) {
    const withoutScheme = url.slice('satviksalaad://'.length);
    // Android fires "satviksalaad:///" as a resume intent when a Chrome Custom
    // Tab closes; it is not a navigation request.
    if (!withoutScheme || withoutScheme === '/') return null;
    return `/${withoutScheme}`;
  }

  return null;
}
