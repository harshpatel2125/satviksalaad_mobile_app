const SITE_HOSTS = new Set(['satviksalaad.com', 'www.satviksalaad.com', 'satviksalaad.in', 'www.satviksalaad.in']);

/**
 * Expo Router calls this before processing any incoming URL (cold start or warm).
 * Universal Links arrive as full HTTPS URLs; we strip the domain + /app prefix
 * so the router sees a plain route path like "/menu" instead of
 * "https://satviksalaad.com/app/menu".
 *
 * This fixes the cold-start Universal Link bug in expo-router (issues #37028, #37401)
 * where router-store.tsx fails to strip the prefix, routing to home instead of
 * the intended screen.
 */
export function redirectSystemPath({
  path,
}: {
  path: string;
  initial: boolean;
}): string {
  try {
    const url = new URL(path);
    if (SITE_HOSTS.has(url.hostname)) {
      // Strip the /app prefix — Expo Router routes don't include it
      const route = url.pathname.replace(/^\/app/, '') || '/';
      return route + (url.search ?? '');
    }
  } catch {
    // Not a full URL (custom scheme or relative path) — pass through as-is
  }
  return path;
}
