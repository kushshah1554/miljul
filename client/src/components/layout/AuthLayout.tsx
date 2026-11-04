import { Outlet } from "react-router-dom";
import AuthLeftPanel from "../auth/AuthLeftPanel";

export function AuthLayout() {
  return (
    <div className="flex min-h-svh w-full bg-background">
      <AuthLeftPanel />
      <Outlet />
    </div>
  );
}
