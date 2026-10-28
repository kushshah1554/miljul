import { apiGet, apiGetWithMeta, apiPost } from "@/lib/api";
import type {
  ChoreAssignment,
  ChoreAssignmentStatus,
  ChoreChecklistItem,
  ChoreFine,
  ChoreReview,
  ChoreReviewDecision,
  ChoreSkipMode,
  ChoreSummary,
  MyChoreAssignment,
  PaginationMeta,
} from "@/lib/types";

// ─── Response shapes (matches Chore.md) ──────────────────────────────────────
interface AssignmentPayload {
  assignment: ChoreAssignment;
}

export interface AssignmentDetailPayload {
  assignment: ChoreAssignment;
  reviews: ChoreReview[]; // oldest → newest; last one is effective
  fine: ChoreFine | null;
  checklist: ChoreChecklistItem[];
}

interface ReviewPayload {
  assignment: ChoreAssignment;
  review: ChoreReview;
  fine: ChoreFine | null;
}

interface SkipPayload {
  skipped: ChoreAssignment;
  takeover: ChoreAssignment | null; // null when the chore needs attention
  chore: ChoreSummary;
}

// ─── Request body / query types ───────────────────────────────────────────────
export interface ListAssignmentsQuery {
  page?: number;
  limit?: number;
  userId?: string;
  status?: ChoreAssignmentStatus;
  overdue?: "true";
  from?: string;
  to?: string;
}

export interface MyAssignmentsQuery {
  page?: number;
  limit?: number;
  open?: "true";
}

export interface ReviewBody {
  decision: ChoreReviewDecision;
  results: Array<{ itemId: string; passed: boolean }>; // every active checklist item once
  feedback?: string; // required when REJECTED
}

export interface SkipBody {
  reason: string;
  mode?: ChoreSkipMode; // default DEFER
  unavailableUntil?: string;
}

export interface WaiveBody {
  reason: string;
  coveredByAssignmentId?: string;
}

const assignmentsUrl = (groupId: string, choreId: string) =>
  `/api/groups/${groupId}/chores/${choreId}/assignments`;
const assignmentUrl = (groupId: string, choreId: string, assignmentId: string) =>
  `${assignmentsUrl(groupId, choreId)}/${assignmentId}`;

// ─── Reads ────────────────────────────────────────────────────────────────────

/** GET …/chores/:choreId/assignments — newest first, paginated */
export function listChoreAssignments(
  groupId: string,
  choreId: string,
  query: ListAssignmentsQuery = {},
) {
  return apiGetWithMeta<{ assignments: ChoreAssignment[] }, PaginationMeta>(
    assignmentsUrl(groupId, choreId),
    { params: query },
  );
}

/** GET /api/groups/:groupId/chore-assignments/mine */
export function listMyAssignments(groupId: string, query: MyAssignmentsQuery = {}) {
  return apiGetWithMeta<{ assignments: MyChoreAssignment[] }, PaginationMeta>(
    `/api/groups/${groupId}/chore-assignments/mine`,
    { params: query },
  );
}

/** GET …/assignments/:assignmentId — with reviews, fine and checklist */
export function getAssignment(groupId: string, choreId: string, assignmentId: string) {
  return apiGet<AssignmentDetailPayload>(assignmentUrl(groupId, choreId, assignmentId));
}

// ─── Actions ──────────────────────────────────────────────────────────────────

/** POST …/submit — assignee; allowed after the deadline */
export function submitAssignment(
  groupId: string,
  choreId: string,
  assignmentId: string,
  note?: string,
) {
  return apiPost<AssignmentPayload>(`${assignmentUrl(groupId, choreId, assignmentId)}/submit`, {
    note,
  });
}

/** POST …/review — owner, or any other member when the owner is the assignee */
export function reviewAssignment(
  groupId: string,
  choreId: string,
  assignmentId: string,
  body: ReviewBody,
) {
  return apiPost<ReviewPayload, ReviewBody>(
    `${assignmentUrl(groupId, choreId, assignmentId)}/review`,
    body,
  );
}

/** POST …/skip-request — assignee of the current turn */
export function requestSkip(groupId: string, choreId: string, assignmentId: string, reason: string) {
  return apiPost<AssignmentPayload>(
    `${assignmentUrl(groupId, choreId, assignmentId)}/skip-request`,
    { reason },
  );
}

/** POST …/skip — OWNER; next eligible member takes over */
export function skipAssignment(
  groupId: string,
  choreId: string,
  assignmentId: string,
  body: SkipBody,
) {
  return apiPost<SkipPayload, SkipBody>(`${assignmentUrl(groupId, choreId, assignmentId)}/skip`, body);
}

/** POST …/waive — OWNER; existing fine is not removed */
export function waiveAssignment(
  groupId: string,
  choreId: string,
  assignmentId: string,
  body: WaiveBody,
) {
  return apiPost<AssignmentPayload, WaiveBody>(
    `${assignmentUrl(groupId, choreId, assignmentId)}/waive`,
    body,
  );
}
