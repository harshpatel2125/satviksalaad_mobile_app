import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/context/auth';
import { appSettingsApi } from '@/lib/api';
import { phoneFromEmail } from '@/lib/phone-email';
import { CACHE_TTL } from '@/lib/query-client';

/** The App Store and Play reviewers' account. */
const REVIEWER_PHONE = '9998299659';

/**
 * Whether this person orders on WhatsApp instead of paying in the app: always
 * the reviewers' number, and, while store review mode is on, anyone without a
 * mobile number, signed in or not. Until the setting has loaded, people without
 * a number are treated as in review mode, so a payment screen never flashes up.
 */
export function useWhatsAppOrdering(): boolean {
  const { profile, user } = useAuth();
  const { data } = useQuery({
    queryKey: ['app-settings'],
    queryFn: appSettingsApi.get,
    staleTime: CACHE_TTL.appSettings,
  });
  const phone = (profile?.phone ?? phoneFromEmail(user?.email) ?? '').replace(/\D/g, '').slice(-10);
  const reviewMode = data ? !!data.data.storeReviewMode : true;
  return phone === REVIEWER_PHONE || (reviewMode && !phone);
}
