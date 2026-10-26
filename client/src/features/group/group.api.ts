import { apiGet, apiPatch, apiPost } from "@/lib/api";
import type { Group } from "@/lib/types";

// ─── Response shapes (matches API_DOCS.md) ───────────────────────────────────
interface GroupPayload {
  group: Group;
}

interface GroupsPayload {
  groups: Group[];
}

interface RegenerateJoinCodePayload {
  joinCode: string;
  group: Group;
}

// ─── Request body / query types ───────────────────────────────────────────────
export type GroupStatus = "active" | "archived" | "all";

export interface CreateGroupBody {
  name: string;
  description?: string | null;
}

export interface UpdateGroupBody {
  name?: string;
  description?: string | null;
}

export interface JoinGroupBody {
  joinCode: string;
}

// ─── API functions ────────────────────────────────────────────────────────────

/** POST /api/groups — caller becomes OWNER */
export function createGroup(body: CreateGroupBody) {
  return apiPost<GroupPayload, CreateGroupBody>("/api/groups", body);
}

/** GET /api/groups?status= */
export function listGroups(status: GroupStatus = "active") {
  return apiGet<GroupsPayload>("/api/groups", { params: { status } });
}

/** POST /api/groups/join */
export function joinGroup(body: JoinGroupBody) {
  return apiPost<GroupPayload, JoinGroupBody>("/api/groups/join", body);
}

/** GET /api/groups/:groupId */
export function getGroup(groupId: string) {
  return apiGet<GroupPayload>(`/api/groups/${groupId}`);
}

/** PATCH /api/groups/:groupId — OWNER */
export function updateGroup(groupId: string, body: UpdateGroupBody) {
  return apiPatch<GroupPayload, UpdateGroupBody>(`/api/groups/${groupId}`, body);
}

/** PATCH /api/groups/:groupId/archive — OWNER */
export function archiveGroup(groupId: string) {
  return apiPatch<GroupPayload>(`/api/groups/${groupId}/archive`);
}

/** PATCH /api/groups/:groupId/restore — OWNER */
export function restoreGroup(groupId: string) {
  return apiPatch<GroupPayload>(`/api/groups/${groupId}/restore`);
}

/** POST /api/groups/:groupId/join-code/regenerate — OWNER */
export function regenerateJoinCode(groupId: string) {
  return apiPost<RegenerateJoinCodePayload>(
    `/api/groups/${groupId}/join-code/regenerate`,
  );
}
