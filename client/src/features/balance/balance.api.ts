import { apiGet } from "@/lib/api";
import type { MemberBalance, SettlementSuggestion } from "@/lib/types";

// ─── Response shapes (matches API_DOCS.md) ───────────────────────────────────
export interface GroupBalancesPayload {
  groupId: string;
  balances: MemberBalance[];
  suggestedSettlements: SettlementSuggestion[];
}

export interface MyBalancePayload {
  groupId: string;
  userId: string;
  totalPaid: string;
  totalShares: string;
  netBalance: string; // positive = owed, negative = owes
}

const balancesUrl = (groupId: string) => `/api/groups/${groupId}/balances`;

// ─── API functions ────────────────────────────────────────────────────────────

/** GET /api/groups/:groupId/balances — every member + suggested settlements */
export function getGroupBalances(groupId: string) {
  return apiGet<GroupBalancesPayload>(balancesUrl(groupId));
}

/** GET /api/groups/:groupId/balances/me */
export function getMyBalance(groupId: string) {
  return apiGet<MyBalancePayload>(`${balancesUrl(groupId)}/me`);
}
