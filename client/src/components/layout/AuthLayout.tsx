import { Outlet } from "react-router-dom";
import AuthLeftPanel from "../auth/AuthLeftPanel";

export function AuthLayout() {
  return (
    <div className="min-h-screen w-full flex bg-white">
      <AuthLeftPanel />
      <Outlet />
    </div>
  );
}
