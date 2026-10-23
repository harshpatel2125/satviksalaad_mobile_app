import { apiFetch } from '@/lib/api';

export type DateRangeKey = 'this_week' | 'prev_week' | 'this_month' | 'prev_month';

export interface ReportRange {
  from: string;
  to: string;
  days: number;
}

export interface ReportQuery {
  range: DateRangeKey;
}

export interface PartnerSelfReport {
  range: ReportRange;
  previous: ReportRange;
  delivered: number;
  missed: number;
  bowls: number;
  completionRate: number;
  activeDays: number;
  bySlot: { slot: string; delivered: number; missed: number; bowls: number }[];
  byArea: { area: string; delivered: number; bowls: number }[];
  series: { date: string; delivered: number; missed: number; bowls: number }[];
  previousTotals: { delivered: number; bowls: number; completionRate: number };
  attribution: { stamped: number; inferred: number };
  partnerName: string | null;
  rangeKey: DateRangeKey;
  rangeLabel: string;
}

export const partnerReportApi = {
  /** The server scopes this to the caller's session; there is no partner id. */
  mine: (query: ReportQuery) =>
    apiFetch<{ success: boolean; data: PartnerSelfReport }>(
      `/api/v1/delivery-partner/report?${new URLSearchParams({ range: query.range }).toString()}`,
    ),
};
