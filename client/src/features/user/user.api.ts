import { apiPatch } from "@/lib/api";
import type { AuthUser } from "@/lib/types";

/** PATCH /api/users/me — optional `name` and `image` fields */
export function updateProfile(body: FormData) {
  // The API client defaults to JSON, which would serialise the FormData and
  // drop the file. With this type, the browser sets the multipart boundary.
  return apiPatch<{ user: AuthUser }, FormData>("/api/users/me", body, {
    headers: { "Content-Type": "multipart/form-data" },
  });
}
