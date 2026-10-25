import type { GroupRole } from "@/lib/types";

// Mirrors the server's per-group permission rules (API_DOCS.md).

/** OWNER or ADMIN — may edit the group and rotate its join code. */
export function canManageGroup(role: GroupRole) {
  return role === "OWNER" || role === "ADMIN";
}

/** OWNER only — may archive / restore the group. */
export function isOwner(role: GroupRole) {
  return role === "OWNER";
}
