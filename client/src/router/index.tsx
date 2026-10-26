import { createBrowserRouter, Navigate } from "react-router-dom";
import { PublicRoute } from "@/components/routes/PublicRoute";
import { PrivateRoute } from "@/components/routes/PrivateRoute";
import LoginPage from "@/pages/auth/LoginPage";
import SignupPage from "@/pages/auth/SignupPage";
import DashboardPage from "@/pages/dashboard/DashboardPage";
import GroupsPage from "@/pages/groups/GroupsPage";
import GroupLayout from "@/pages/groups/GroupLayout";
import GroupOverviewPage from "@/pages/groups/GroupOverviewPage";
import GroupExpensesPage from "@/pages/groups/GroupExpensesPage";
import GroupBalancesPage from "@/pages/groups/GroupBalancesPage";
import GroupMembersPage from "@/pages/groups/GroupMembersPage";
import GroupSettingsPage from "@/pages/groups/GroupSettingsPage";
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
          {
            path: "/groups/:groupId",
            element: <GroupLayout />,
            children: [
              { index: true, element: <GroupOverviewPage /> },
              { path: "expenses", element: <GroupExpensesPage /> },
              { path: "balances", element: <GroupBalancesPage /> },
              { path: "members", element: <GroupMembersPage /> },
              { path: "settings", element: <GroupSettingsPage /> },
            ],
          },
          // Add more protected routes here as the app grows
        ],
      },
    ],
  },

  // ─── Catch-all ────────────────────────────────────────────────────────────
  { path: "/", element: <Navigate to="/login" replace /> },
  { path: "*", element: <Navigate to="/login" replace /> },
]);
