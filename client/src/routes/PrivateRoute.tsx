import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";

/**
 * PrivateRoute — accessible only when authenticated.
 * Redirects to /login when the user is not logged in.
 * Use this to wrap all protected pages (dashboard, groups, etc.).
 */
export function PrivateRoute() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
