import { Linking, Platform } from 'react-native';

/** Numbers are stored bare (10 digits) and WhatsApp needs a country code. */
const DEFAULT_COUNTRY_CODE = '91';

/**
 * Normalises a stored number to the digits-only international form WhatsApp
 * expects — "9876543210" -> "919876543210".
 *
 * Handles the shapes that actually turn up: a bare 10-digit number, one written
 * with +91 or 0091, and one with a leading trunk 0. Returns null when there is
 * nothing dialable, so callers can hide the action rather than open a dead link.
 */
export function toWhatsAppNumber(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let digits = raw.replace(/\D/g, '');
  if (!digits) return null;

  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.length === 10) return `${DEFAULT_COUNTRY_CODE}${digits}`;
  // Trunk prefix: 0 followed by a full national number.
  if (digits.length === 11 && digits.startsWith('0')) {
    return `${DEFAULT_COUNTRY_CODE}${digits.slice(1)}`;
  }
  // Already carries a country code.
  if (digits.length >= 11 && digits.length <= 15) return digits;
  return null;
}

/** Opens the dialer. `tel:` is honoured on both platforms. */
export async function callNumber(raw: string | null | undefined): Promise<boolean> {
  if (!raw) return false;
  const digits = raw.replace(/[^\d+]/g, '');
  if (!digits) return false;
  try {
    await Linking.openURL(`tel:${digits}`);
    return true;
  } catch {
    return false;
  }
}

export interface MapTarget {
  /** A saved link takes precedence — someone chose that pin deliberately. */
  gmapUrl?: string | null;
  lat?: number | null;
  lng?: number | null;
  address?: string | null;
  /** Pin label, so the driver sees who it belongs to. */
  label?: string | null;
}

/**
 * Maps links for a stop, best first: the saved pin, then Google Maps on both
 * platforms (saved addresses and pins come from Google), Apple Maps last.
 * canOpenURL is unreliable without per-scheme manifest entries, so openMap
 * tries each in turn.
 */
function mapCandidates(target: MapTarget): string[] {
  const { gmapUrl, lat, lng, address, label } = target;
  const isIOS = Platform.OS === 'ios';
  const hasCoords =
    typeof lat === 'number' && typeof lng === 'number' &&
    Number.isFinite(lat) && Number.isFinite(lng);
  // Parentheses delimit the geo: label, so a name containing one — "Sharma
  // (Flat 2B)" — would terminate it early and leave the rest to be parsed as
  // part of the URI.
  const pin = (label ?? address ?? 'Delivery').replace(/[()]/g, ' ').trim();
  const urls: string[] = [];

  if (gmapUrl?.trim()) urls.push(gmapUrl.trim());

  if (hasCoords) {
    if (isIOS) {
      urls.push(`comgooglemaps://?q=${lat},${lng}&center=${lat},${lng}&zoom=17`);
    } else {
      urls.push(`geo:${lat},${lng}?q=${lat},${lng}(${encodeURIComponent(pin)})`);
      // Bare coordinates, no label — the least a geo: handler can refuse.
      urls.push(`geo:${lat},${lng}`);
    }
    urls.push(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`);
    urls.push(`https://maps.google.com/maps?q=${lat},${lng}`);
  }

  const text = address?.trim();
  if (text) {
    const q = encodeURIComponent(text);
    if (isIOS) urls.push(`comgooglemaps://?q=${q}`);
    else urls.push(`geo:0,0?q=${q}`);
    urls.push(`https://www.google.com/maps/search/?api=1&query=${q}`);
    urls.push(`https://maps.google.com/maps?q=${q}`);
  }

  // Apple Maps last, and only on iOS.
  if (isIOS) {
    if (hasCoords) urls.push(`maps://?ll=${lat},${lng}&q=${encodeURIComponent(pin)}`);
    if (text) urls.push(`maps://?q=${encodeURIComponent(text)}`);
  }

  return [...new Set(urls)];
}

/** Opens the location in a maps app. False when the device refused every candidate. */
export async function openMap(target: MapTarget): Promise<boolean> {
  for (const url of mapCandidates(target)) {
    try {
      await Linking.openURL(url);
      return true;
    } catch {
      // This device has no handler for that shape. Try the next one.
    }
  }
  return false;
}
