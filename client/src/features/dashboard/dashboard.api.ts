import { apiGet } from "@/lib/api";

// ─── Response shapes (matches API_DOCS.md) ───────────────────────────────────
/** today and month are null for any year but the current one */
export interface DashboardTotals {
  today: string | null;
  month: string | null;
  year: string;
}

export interface DashboardPayload {
  year: number;
  years: number[]; // newest first; years[0] is the current year
  groupsJoined: number;
  spent: DashboardTotals;
  fines: DashboardTotals;
  chores: { late: number; rejected: number; approved: number };
}

/** GET /api/dashboard — my totals across all groups */
export function getDashboard(year?: number) {
  const { timeZone } = Intl.DateTimeFormat().resolvedOptions();
  return apiGet<DashboardPayload>("/api/dashboard", { params: { year, timezone: timeZone } });
}
