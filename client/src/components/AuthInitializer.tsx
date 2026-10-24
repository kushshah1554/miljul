import { useEffect, useState } from "react";
import { refreshToken } from "@/api/auth.api";
import { useAuthStore } from "@/store/authStore";

interface AuthInitializerProps {
  children: React.ReactNode;
}

/**
 * AuthInitializer — on mount, attempts to silently restore the session using
 * the HttpOnly refresh-token cookie. If successful, the Zustand auth store is
 * populated. The app renders a loading state while this runs so route guards
 * don't flash the wrong page.
 */
export function AuthInitializer({ children }: AuthInitializerProps) {
  const { setAuth } = useAuthStore();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    refreshToken()
      .then(({ user, accessToken }) => {
        setAuth(user, accessToken);
      })
      .catch(() => {
        // No valid session — user will land on /login, which is correct
      })
      .finally(() => {
        setIsReady(true);
      });
  }, [setAuth]);

  if (!isReady) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "hsl(222 47% 6%)",
        }}
      >
        <span className="spinner" style={{ width: "2rem", height: "2rem" }} />
      </div>
    );
  }

  return <>{children}</>;
}
