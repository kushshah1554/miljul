import { apiDelete, apiGet, apiPost } from "@/lib/api";
import type { GroupMemberRecord, MembershipScalars } from "@/lib/types";

// ─── Response shapes (matches API_DOCS.md) ───────────────────────────────────
interface MembersPayload {
  members: GroupMemberRecord[];
}

interface MembershipPayload {
  membership: GroupMemberRecord;
}

// ─── Request body types ───────────────────────────────────────────────────────
export interface TransferOwnershipBody {
  newOwnerId: string;
}

const membersUrl = (groupId: string) => `/api/groups/${groupId}/members`;

// ─── API functions ────────────────────────────────────────────────────────────

/** GET /api/groups/:groupId/members — ordered OWNER → MEMBER, then joinedAt */
export function listMembers(groupId: string) {
  return apiGet<MembersPayload>(membersUrl(groupId));
}

/** GET /api/groups/:groupId/members/me */
export function getMyMembership(groupId: string) {
  return apiGet<{ membership: MembershipScalars }>(`${membersUrl(groupId)}/me`);
}

/** DELETE /api/groups/:groupId/members/:userId — 204; own userId = leave */
export function removeMember(groupId: string, userId: string) {
  return apiDelete(`${membersUrl(groupId)}/${userId}`);
}

/** POST /api/groups/:groupId/ownership-transfer — OWNER; caller becomes MEMBER */
export function transferOwnership(groupId: string, body: TransferOwnershipBody) {
  return apiPost<MembershipPayload, TransferOwnershipBody>(
    `/api/groups/${groupId}/ownership-transfer`,
    body,
  );
}
