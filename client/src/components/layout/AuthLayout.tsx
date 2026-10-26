import { Outlet } from "react-router-dom";
import AuthLeftPanel from "../auth/AuthLeftPanel";

export function AuthLayout() {
  return (
    // Same grey page + white rounded frame as the app shell
    <div className="min-h-svh md:p-5">
      <div className="flex min-h-svh w-full bg-background md:min-h-[calc(100svh-2.5rem)] md:gap-4 md:rounded-[2.5rem] md:p-4 md:shadow-2xl md:shadow-black/10">
        <AuthLeftPanel />
        <Outlet />
      </div>
    </div>
  );
}
