import { apiDelete, apiGet, apiGetWithMeta, apiPatch, apiPost, apiPut } from "@/lib/api";
import type {
  ChoreChecklistItem,
  ChoreCycle,
  ChoreDetail,
  ChoreParticipant,
  ChorePause,
  ChoreStatus,
  ChoreSummary,
  PaginationMeta,
  UpcomingTurn,
} from "@/lib/types";

// ─── Response shapes (matches Chore.md) ──────────────────────────────────────
interface ChorePayload {
  chore: ChoreDetail;
}

interface ChoreSummaryPayload {
  chore: ChoreSummary;
}

export interface ChoresPayload {
  chores: ChoreSummary[];
  groupPausedAt: string | null;
}

interface CyclePayload {
  cycle: ChoreCycle;
  upcoming: UpcomingTurn[];
}

// ─── Request body / query types ───────────────────────────────────────────────
export interface CreateChoreBody {
  name: string;
  description?: string;
  intervalDays: number;
  deadlineTime?: string; // "HH:MM" local, default "11:30"
  finePerMember?: string; // decimal string, default "20.00"
  startDate?: string; // "YYYY-MM-DD" in group timezone, default today
  participantIds: string[]; // array order = original queue
  checklist?: string[];
}

export interface UpdateChoreBody {
  name?: string;
  description?: string | null;
  intervalDays?: number;
  deadlineTime?: string;
  finePerMember?: string;
}

export interface AddParticipantBody {
  userId: string;
  position?: number;
  cyclePosition?: number;
}

export type CurrentTurnChoice = "reassign" | "keep";

export interface SetAvailabilityBody {
  unavailableUntil: string | null; // ISO datetime in the future, null = available now
  reason?: string;
}

export interface ChecklistItemInput {
  id?: string; // keep an existing item
  label: string;
}

export interface ListPausesQuery {
  page?: number;
  limit?: number;
  choreId?: string;
  groupWide?: "true";
}

const choresUrl = (groupId: string) => `/api/groups/${groupId}/chores`;
const choreUrl = (groupId: string, choreId: string) => `${choresUrl(groupId)}/${choreId}`;

// ─── Chores ───────────────────────────────────────────────────────────────────

/** POST /api/groups/:groupId/chores — OWNER */
export function createChore(groupId: string, body: CreateChoreBody) {
  return apiPost<ChorePayload, CreateChoreBody>(choresUrl(groupId), body);
}

/** GET /api/groups/:groupId/chores?status= — default: all except ARCHIVED */
export function listChores(groupId: string, status?: ChoreStatus) {
  return apiGet<ChoresPayload>(choresUrl(groupId), { params: { status } });
}

/** GET /api/groups/:groupId/chores/:choreId?upcoming= */
export function getChore(groupId: string, choreId: string, upcoming?: number) {
  return apiGet<ChorePayload>(choreUrl(groupId, choreId), { params: { upcoming } });
}

/** PATCH /api/groups/:groupId/chores/:choreId — OWNER */
export function updateChore(groupId: string, choreId: string, body: UpdateChoreBody) {
  return apiPatch<ChorePayload, UpdateChoreBody>(choreUrl(groupId, choreId), body);
}

/** PATCH /api/groups/:groupId/chores/:choreId/archive — OWNER */
export function archiveChore(groupId: string, choreId: string, reason?: string) {
  return apiPatch<ChoreSummaryPayload>(`${choreUrl(groupId, choreId)}/archive`, { reason });
}

/** PATCH /api/groups/:groupId/chores/:choreId/restore — OWNER */
export function restoreChore(groupId: string, choreId: string) {
  return apiPatch<ChoreSummaryPayload>(`${choreUrl(groupId, choreId)}/restore`, {});
}

// ─── Participants ─────────────────────────────────────────────────────────────

/** POST /api/groups/:groupId/chores/:choreId/participants — OWNER */
export function addParticipant(groupId: string, choreId: string, body: AddParticipantBody) {
  return apiPost<ChorePayload, AddParticipantBody>(
    `${choreUrl(groupId, choreId)}/participants`,
    body,
  );
}

/** DELETE …/participants/:userId?currentTurn= — required when they hold the current turn */
export function removeParticipant(
  groupId: string,
  choreId: string,
  userId: string,
  currentTurn?: CurrentTurnChoice,
) {
  return apiDelete<ChorePayload>(`${choreUrl(groupId, choreId)}/participants/${userId}`, {
    params: { currentTurn },
  });
}

/** PATCH …/participants/:userId/availability — OWNER */
export function setAvailability(
  groupId: string,
  choreId: string,
  userId: string,
  body: SetAvailabilityBody,
) {
  return apiPatch<{ participant: ChoreParticipant }, SetAvailabilityBody>(
    `${choreUrl(groupId, choreId)}/participants/${userId}/availability`,
    body,
  );
}

// ─── Queues ───────────────────────────────────────────────────────────────────

/** PUT …/queue/original — takes effect from the next cycle */
export function reorderOriginalQueue(groupId: string, choreId: string, order: string[]) {
  return apiPut<ChorePayload>(`${choreUrl(groupId, choreId)}/queue/original`, { order });
}

/** POST …/queue/swap — two pending members of the current cycle */
export function swapInCycle(groupId: string, choreId: string, userIdA: string, userIdB: string) {
  return apiPost<CyclePayload>(`${choreUrl(groupId, choreId)}/queue/swap`, { userIdA, userIdB });
}

/** POST …/queue/move — toIndex must be ≥ lockedCount */
export function moveInCycle(groupId: string, choreId: string, userId: string, toIndex: number) {
  return apiPost<CyclePayload>(`${choreUrl(groupId, choreId)}/queue/move`, { userId, toIndex });
}

// ─── Checklist ────────────────────────────────────────────────────────────────

/** PUT …/checklist — omitted items are archived */
export function replaceChecklist(groupId: string, choreId: string, items: ChecklistItemInput[]) {
  return apiPut<{ checklist: ChoreChecklistItem[] }>(`${choreUrl(groupId, choreId)}/checklist`, {
    items,
  });
}

// ─── Pause / resume ───────────────────────────────────────────────────────────

/** POST …/:choreId/pause — OWNER */
export function pauseChore(groupId: string, choreId: string, reason?: string) {
  return apiPost<ChoreSummaryPayload>(`${choreUrl(groupId, choreId)}/pause`, { reason });
}

/** POST …/:choreId/resume — clock stays frozen while a group-wide pause is active */
export function resumeChore(groupId: string, choreId: string, reason?: string) {
  return apiPost<ChoreSummaryPayload>(`${choreUrl(groupId, choreId)}/resume`, { reason });
}

/** POST /api/groups/:groupId/chores/pause-all — OWNER */
export function pauseAllChores(groupId: string, reason?: string) {
  return apiPost<ChoresPayload>(`${choresUrl(groupId)}/pause-all`, { reason });
}

/** POST /api/groups/:groupId/chores/resume-all — individually paused chores stay paused */
export function resumeAllChores(groupId: string, reason?: string) {
  return apiPost<ChoresPayload>(`${choresUrl(groupId)}/resume-all`, { reason });
}

/** GET /api/groups/:groupId/chore-pauses — newest first, paginated */
export function listPauses(groupId: string, query: ListPausesQuery = {}) {
  return apiGetWithMeta<{ pauses: ChorePause[] }, PaginationMeta>(
    `/api/groups/${groupId}/chore-pauses`,
    { params: query },
  );
}
