import type { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import type React from 'react';

import { appSettingsApi } from '@/lib/api';
import { toWhatsAppNumber } from '@/lib/contact-actions';
import { CACHE_TTL } from '@/lib/query-client';

/** Used until app settings load, or when the admin has left a field empty. */
const FALLBACK_PHONE = '9316102899';
const FALLBACK_EMAIL = 'care@satviksalaad.com';

export type SocialLink = {
  key: 'instagram' | 'facebook' | 'youtube' | 'linkedin';
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  url: string;
};

/** "9316102899" or "+91 93161-02899" → "+91 93161 02899". */
export function formatIndianPhone(raw: string): string {
  const national = raw.replace(/\D/g, '').slice(-10);
  return national.length === 10 ? `+91 ${national.slice(0, 5)} ${national.slice(5)}` : raw;
}

export function useSupportContact() {
  const { data } = useQuery({
    queryKey: ['app-settings'],
    queryFn: appSettingsApi.get,
    staleTime: CACHE_TTL.appSettings,
  });
  const settings = data?.data;

  const phone = settings?.supportPhone?.trim() || FALLBACK_PHONE;
  const whatsappNumber = toWhatsAppNumber(phone);
  const candidates: (Omit<SocialLink, 'url'> & { url: string | null | undefined })[] = [
    { key: 'instagram', label: 'Instagram', icon: 'logo-instagram', url: settings?.instagramUrl },
    { key: 'facebook', label: 'Facebook', icon: 'logo-facebook', url: settings?.facebookUrl },
    { key: 'youtube', label: 'YouTube', icon: 'logo-youtube', url: settings?.youtubeUrl },
    { key: 'linkedin', label: 'LinkedIn', icon: 'logo-linkedin', url: settings?.linkedinUrl },
  ];

  return {
    phone,
    phoneDisplay: formatIndianPhone(phone),
    whatsappUrl: whatsappNumber ? `https://wa.me/${whatsappNumber}` : null,
    email: settings?.supportEmail?.trim() || FALLBACK_EMAIL,
    socials: candidates.filter((s): s is SocialLink => Boolean(s.url?.trim())),
  };
}
