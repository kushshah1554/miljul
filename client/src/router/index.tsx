import { createBrowserRouter, Navigate } from "react-router-dom";
import { PublicRoute } from "@/components/routes/PublicRoute";
import { PrivateRoute } from "@/components/routes/PrivateRoute";
import LoginPage from "@/pages/auth/LoginPage";
import SignupPage from "@/pages/auth/SignupPage";
import DashboardPage from "@/pages/dashboard/DashboardPage";
import { AuthLayout } from "@/components/layout/AuthLayout";

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
      { path: "/dashboard", element: <DashboardPage /> },
      // Add more protected routes here as the app grows
    ],
  },

  // ─── Catch-all ────────────────────────────────────────────────────────────
  { path: "/", element: <Navigate to="/login" replace /> },
  { path: "*", element: <Navigate to="/login" replace /> },
]);
