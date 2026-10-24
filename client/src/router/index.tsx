import { createBrowserRouter, Navigate } from "react-router-dom";
import { PublicRoute } from "@/routes/PublicRoute";
import { PrivateRoute } from "@/routes/PrivateRoute";
import LoginPage from "@/pages/auth/LoginPage";
import SignupPage from "@/pages/auth/SignupPage";
import DashboardPage from "@/pages/dashboard/DashboardPage";

export const router = createBrowserRouter([
  // ─── Public routes (redirect to /dashboard if already logged in) ─────────
  {
    element: <PublicRoute />,
    children: [
      { path: "/login", element: <LoginPage /> },
      { path: "/signup", element: <SignupPage /> },
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
