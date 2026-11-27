import { apiGet } from "@/lib/api";
import type { DashboardPayload } from "@/features/dashboard/dashboard.api";

// ─── Response shapes (matches API_DOCS.md) ───────────────────────────────────
type GroupTotals = Pick<DashboardPayload, "spent" | "fines" | "chores">;

export interface GroupOverviewPayload {
  year: number;
  years: number[]; // newest first; years[0] is the current year
  mine: GroupTotals;
  group: GroupTotals;
}

export interface LeaderboardMember {
  user: { id: string; name: string; profileUrl: string | null };
  spent: string;
  fines: string;
  approved: number;
  late: number;
  rejected: number;
}

export interface LeaderboardPayload {
  year: number;
  month: number | null; // null = the whole year
  months: number[]; // months of `year` that can be picked
  members: LeaderboardMember[];
}

// ─── API functions ────────────────────────────────────────────────────────────

/** GET /api/groups/:groupId/overview — my totals and the whole group's */
export function getGroupOverview(groupId: string, year?: number) {
  return apiGet<GroupOverviewPayload>(`/api/groups/${groupId}/overview`, { params: { year } });
}

/** GET /api/groups/:groupId/leaderboard — per-member totals of a year or month */
export function getGroupLeaderboard(groupId: string, year: number, month?: number) {
  return apiGet<LeaderboardPayload>(`/api/groups/${groupId}/leaderboard`, {
    params: { year, month },
  });
}
