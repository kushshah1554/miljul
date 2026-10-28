import { apiGet, apiGetWithMeta, apiPost } from "@/lib/api";
import type { ChoreFine, ChoreFineStatus, FineSummaryMember, PaginationMeta } from "@/lib/types";

// ─── Request query types ──────────────────────────────────────────────────────
export interface ListFinesQuery {
  page?: number;
  limit?: number;
  choreId?: string;
  payerId?: string;
  recipientId?: string;
  status?: ChoreFineStatus;
}

const finesUrl = (groupId: string) => `/api/groups/${groupId}/chore-fines`;

// ─── API functions ────────────────────────────────────────────────────────────

/** GET /api/groups/:groupId/chore-fines — newest first, paginated */
export function listFines(groupId: string, query: ListFinesQuery = {}) {
  return apiGetWithMeta<{ fines: ChoreFine[] }, PaginationMeta>(finesUrl(groupId), {
    params: query,
  });
}

/** GET /api/groups/:groupId/chore-fines/summary — ACTIVE fines netted per member */
export function getFineSummary(groupId: string) {
  return apiGet<{ members: FineSummaryMember[] }>(`${finesUrl(groupId)}/summary`);
}

/** POST /api/groups/:groupId/chore-fines/:fineId/void — OWNER */
export function voidFine(groupId: string, fineId: string, reason: string) {
  return apiPost<{ fine: ChoreFine }>(`${finesUrl(groupId)}/${fineId}/void`, { reason });
}
