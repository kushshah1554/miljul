import { RouterProvider } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { router } from "@/router";
import { queryClient } from "@/lib/queryClient";
import { AuthInitializer } from "@/features/auth/AuthInitializer";
import { useApplyTheme, useThemeStore } from "@/hooks/use-theme";
// Bootstrap auth store so the token getter is wired up before any request fires
import "@/features/auth/authStore";

export default function App() {
  useApplyTheme();
  const theme = useThemeStore((s) => s.theme);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthInitializer>
        <RouterProvider router={router} />
      </AuthInitializer>
      <Toaster theme={theme} position="top-right" richColors closeButton />
    </QueryClientProvider>
  );
}
