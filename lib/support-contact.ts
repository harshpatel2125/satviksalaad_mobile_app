import type { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import type React from 'react';

import { appSettingsApi, cafeApi } from '@/lib/api';
import { openStatus, type OpeningHours } from '@/lib/cafe-order';
import { toWhatsAppNumber } from '@/lib/contact-actions';
import { asyncPersister, CACHE_TTL } from '@/lib/query-client';

/** Used until app settings load, or when the admin has left a field empty. */
const FALLBACK_PHONE = '9316102899';
const FALLBACK_EMAIL = 'care@satviksalaad.com';

/** Used until the café menu loads. */
const FALLBACK_CAFE = {
  addressText: 'GF Shop No. 2, Campus Corner 1, Opp. Prahladnagar Garden, Ahmedabad 380015',
  mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Satvik+Salaad+Campus+Corner+1+Prahladnagar+Ahmedabad',
  hours: {
    openDays: [0, 1, 2, 3, 4, 5, 6],
    opens: '08:00',
    closes: '23:00',
    daysLabel: 'Every day',
    timeLabel: '8:00 AM – 11:00 PM',
  } satisfies OpeningHours,
};

/** The café's address and hours as the website has them, and whether it is open now. */
export function useCafeInfo() {
  const { data } = useQuery({
    queryKey: ['cafe-menu'],
    queryFn: () => cafeApi.menu(),
    staleTime: CACHE_TTL.menu,
    persister: asyncPersister.persisterFn,
  });
  const outlet = data?.data.outlet ?? FALLBACK_CAFE;
  return {
    address: outlet.addressText,
    mapsUrl: outlet.mapsUrl,
    hoursLabel: `${outlet.hours.daysLabel} · ${outlet.hours.timeLabel}`,
    timeLabel: outlet.hours.timeLabel,
    isOpen: openStatus(new Date(), outlet.hours).isOpen,
  };
}

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
    swiggyUrl: settings?.swiggyUrl?.trim() || null,
    zomatoUrl: settings?.zomatoUrl?.trim() || null,
    legal: {
      name: settings?.legalName ?? 'Bellaviso HealthTech LLP',
      gstin: settings?.gstin ?? null,
      fssai: settings?.fssai ?? null,
    },
  };
}
