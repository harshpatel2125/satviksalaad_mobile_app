import type { AppSettings } from '@/types/api';

const SITE_URL = 'https://satviksalaad.com';

/** The admin's policy URLs, or the website's own pages for any left empty. */
export function policyUrls(settings: AppSettings | null | undefined) {
  return {
    privacy: settings?.privacyPolicyUrl || `${SITE_URL}/privacy-policy`,
    terms: settings?.termsUrl || `${SITE_URL}/terms`,
    refund: settings?.refundPolicyUrl || `${SITE_URL}/refund-policy`,
    delivery: settings?.deliveryPolicyUrl || `${SITE_URL}/delivery-policy`,
  };
}
