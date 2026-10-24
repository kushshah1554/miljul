import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { login, signup, logout } from "@/features/auth/auth.api";
import { useAuthStore } from "@/features/auth/authStore";
import type { LoginBody, SignupBody } from "@/features/auth/auth.api";

// ─── Login ────────────────────────────────────────────────────────────────────
export function useLogin() {
  const { setAuth } = useAuthStore();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (body: LoginBody) => login(body),
    onSuccess: ({ user, accessToken }) => {
      setAuth(user, accessToken);
      toast.success(`Welcome back, ${user.name}!`);
      navigate("/dashboard", { replace: true });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

// ─── Signup ───────────────────────────────────────────────────────────────────
export function useSignup() {
  const { setAuth } = useAuthStore();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (body: SignupBody) => signup(body),
    onSuccess: ({ user, accessToken }) => {
      setAuth(user, accessToken);
      toast.success(`Account created! Welcome, ${user.name}!`);
      navigate("/dashboard", { replace: true });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

// ─── Logout ───────────────────────────────────────────────────────────────────
export function useLogout() {
  const { clearAuth } = useAuthStore();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: logout,
    onSettled: () => {
      // Clear local state regardless of API success/failure
      clearAuth();
      navigate("/login", { replace: true });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}
