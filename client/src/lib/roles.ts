import type { GroupRole } from "@/lib/types";

// Mirrors the server's per-group permission rules (API_DOCS.md).

/** OWNER only — may edit, archive / restore the group, rotate its join code and remove members. */
export function isOwner(role: GroupRole) {
  return role === "OWNER";
}

/**
 * Chore reviews: never your own work; the owner reviews everyone else, and
 * any other member reviews the owner's work (Chore.md → Permissions).
 */
export function canReviewChore(myRole: GroupRole, myUserId: string, assigneeId: string, ownerId?: string) {
  if (assigneeId === myUserId) return false;
  return isOwner(myRole) || assigneeId === ownerId;
}
