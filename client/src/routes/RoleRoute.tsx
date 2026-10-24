import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import type { GroupRole } from "@/lib/types";

interface RoleRouteProps {
  /**
   * Which roles are allowed to access this route.
   * The user's role is checked against the `allowedRoles` array.
   * Note: group-level role checks are done per-page after fetching the group;
   * this guard handles app-level role enforcement if needed.
   */
  allowedRoles: GroupRole[];
  /** The role to check from the auth store (extend AuthUser when needed). */
  redirectTo?: string;
}

/**
 * RoleRoute — extends PrivateRoute with role-based access control.
 *
 * Usage: wrap a route with <RoleRoute allowedRoles={["OWNER", "ADMIN"]} />.
 *
 * NOTE: Because group roles are per-group (not global on the user), this guard
 * is primarily for future global role fields (e.g. app-level admin). For
 * per-group role enforcement, handle it inside the page component after
 * fetching the group membership.
 */
export function RoleRoute({
  allowedRoles,
  redirectTo: _redirectTo = "/dashboard",
}: RoleRouteProps) {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Extend this check once you add a global role field to AuthUser
  // For now, if the user object exists we let them through (roles are per-group)
  if (user && allowedRoles.length > 0) {
    // Placeholder: no global role on AuthUser yet — always allow authenticated users
    // Replace with: if (!allowedRoles.includes(user.role)) { ... }
  }

  return <Outlet />;
}
