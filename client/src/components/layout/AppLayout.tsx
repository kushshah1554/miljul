import { Outlet } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppSidebar, MobileHeader } from "./AppSidebar";

export function AppLayout() {
  return (
    <TooltipProvider>
      {/* Grey page → white rounded frame holding the icon rail and content */}
      <div className="min-h-svh md:p-5">
        <div className="flex min-h-svh flex-col bg-background md:min-h-[calc(100svh-2.5rem)] md:flex-row md:rounded-[2.5rem] md:shadow-2xl md:shadow-black/10">
          <AppSidebar />
          <MobileHeader />
          <main className="flex min-w-0 flex-1 flex-col">
            <Outlet />
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}
