import { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, LogIn, Building2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { loginSchema, type LoginFormValues } from "@/schemas/auth.schema";
import { useLogin } from "@/hooks/useAuth";

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const { mutate: handleLogin, isPending } = useLogin();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = (data: LoginFormValues) => {
    handleLogin({ email: data.email, password: data.password });
  };

  return (
    <div className="auth-bg">
      <div className="glass-card w-full max-w-md p-8 space-y-7">

        {/* ── Brand header ──────────────────────────────────────────── */}
        <div className="text-center space-y-2">
          <div
            className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-2"
            style={{ background: "linear-gradient(135deg, oklch(0.62 0.22 278), oklch(0.55 0.2 245))" }}
          >
            <Building2 className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Welcome back</h1>
          <p className="text-sm text-muted-foreground">
            Sign in to your{" "}
            <span className="brand-gradient font-semibold">RoomManager</span>{" "}
            account
          </p>
        </div>

        {/* ── Form ──────────────────────────────────────────────────── */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>

          {/* Email */}
          <div className="space-y-1.5">
            <Label htmlFor="login-email">Email address</Label>
            <Input
              id="login-email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              className="input-glass"
              aria-invalid={!!errors.email}
              {...register("email")}
            />
            {errors.email && (
              <p className="field-error" role="alert">
                {errors.email.message}
              </p>
            )}
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <Label htmlFor="login-password">Password</Label>
            <div className="relative">
              <Input
                id="login-password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="••••••••"
                className="input-glass pr-10"
                aria-invalid={!!errors.password}
                {...register("password")}
              />
              <button
                type="button"
                aria-label={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword((v) => !v)}
                className="pw-toggle"
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
            {errors.password && (
              <p className="field-error" role="alert">
                {errors.password.message}
              </p>
            )}
          </div>

          {/* Submit */}
          <Button
            id="login-submit"
            type="submit"
            disabled={isPending}
            size="lg"
            className="btn-gradient w-full font-semibold"
          >
            {isPending ? (
              <>
                <span className="spinner" />
                Signing in…
              </>
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                Sign in
              </>
            )}
          </Button>
        </form>

        {/* ── Divider ───────────────────────────────────────────────── */}
        <div className="auth-divider">or</div>

        {/* ── Sign up link ───────────────────────────────────────────── */}
        <p className="text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link
            to="/signup"
            className="text-primary font-medium hover:opacity-80 transition-opacity underline-offset-4 hover:underline"
          >
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
