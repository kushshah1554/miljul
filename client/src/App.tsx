import { useEffect } from "react";
import { RouterProvider } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { router } from "@/router";
import { queryClient } from "@/lib/queryClient";
import { AuthInitializer } from "@/features/auth/AuthInitializer";
// Bootstrap auth store so the token getter is wired up before any request fires
import "@/features/auth/authStore";

export default function App() {
  // Force dark mode — shadcn dark tokens are scoped to .dark class
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthInitializer>
        <RouterProvider router={router} />
      </AuthInitializer>
      <Toaster
        position="top-right"
        richColors
        closeButton
        toastOptions={{
          style: {
            background: "oklch(0.16 0.022 265 / 0.9)",
            backdropFilter: "blur(16px)",
            border: "1px solid oklch(0.62 0.22 278 / 0.25)",
            color: "oklch(0.95 0.008 260)",
          },
        }}
      />
    </QueryClientProvider>
  );
}
