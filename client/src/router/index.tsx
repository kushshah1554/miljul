import { createBrowserRouter, Navigate } from "react-router-dom";
import { PublicRoute } from "@/components/routes/PublicRoute";
import { PrivateRoute } from "@/components/routes/PrivateRoute";
import LoginPage from "@/pages/auth/LoginPage";
import SignupPage from "@/pages/auth/SignupPage";
import DashboardPage from "@/pages/dashboard/DashboardPage";
import GroupsPage from "@/pages/groups/GroupsPage";
import GroupDetailPage from "@/pages/groups/GroupDetailPage";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { AppLayout } from "@/components/layout/AppLayout";

export const router = createBrowserRouter([
  // ─── Public routes (redirect to /dashboard if already logged in) ─────────
  {
    element: <PublicRoute />,
    children: [
      {
        element: <AuthLayout />,
        children: [
          { path: "/login", element: <LoginPage /> },
          { path: "/signup", element: <SignupPage /> },
        ],
      },
    ],
  },

  // ─── Private routes (redirect to /login if not authenticated) ────────────
  {
    element: <PrivateRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: "/dashboard", element: <DashboardPage /> },
          { path: "/groups", element: <GroupsPage /> },
          { path: "/groups/:groupId", element: <GroupDetailPage /> },
          // Add more protected routes here as the app grows
        ],
      },
    ],
  },

  // ─── Catch-all ────────────────────────────────────────────────────────────
  { path: "/", element: <Navigate to="/login" replace /> },
  { path: "*", element: <Navigate to="/login" replace /> },
]);
