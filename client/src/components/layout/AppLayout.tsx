import { Outlet } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppSidebar, MobileHeader } from "./AppSidebar";

export function AppLayout() {
  return (
    <TooltipProvider>
      <div className="flex min-h-svh flex-col bg-background md:flex-row">
        <AppSidebar />
        <MobileHeader />
        <main className="flex min-w-0 flex-1 flex-col">
          <Outlet />
        </main>
      </div>
    </TooltipProvider>
  );
}
