import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";

/**
 * PublicRoute — accessible only when NOT authenticated.
 * Redirects to /dashboard when the user is already logged in.
 * Use this to wrap Login and Signup pages.
 */
export function PublicRoute() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
