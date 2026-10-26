import type { GroupRole } from "@/lib/types";

// Mirrors the server's per-group permission rules (API_DOCS.md).

/** OWNER only — may edit, archive / restore the group, rotate its join code and remove members. */
export function isOwner(role: GroupRole) {
  return role === "OWNER";
}
