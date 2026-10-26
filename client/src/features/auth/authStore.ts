import { create } from "zustand";
import { setTokenGetter } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import type { AuthUser } from "@/lib/types";

// ─── State shape ─────────────────────────────────────────────────────────────
interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;

  // Actions
  setAuth: (user: AuthUser, accessToken: string) => void;
  clearAuth: () => void;
}

// ─── Store ───────────────────────────────────────────────────────────────────
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,

  setAuth: (user, accessToken) => {
    set({ user, accessToken, isAuthenticated: true });
  },

  clearAuth: () => {
    set({ user: null, accessToken: null, isAuthenticated: false });
    // Drop cached server data so the next account never sees this user's groups/roles
    queryClient.clear();
  },
}));

// ─── Wire up the token getter to the API client (run once at module load) ────
// This avoids circular imports: the api module reads the token via a getter
// function rather than importing the store directly.
setTokenGetter(() => useAuthStore.getState().accessToken);
