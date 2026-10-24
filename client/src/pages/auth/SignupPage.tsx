import { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, UserPlus, Building2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { signupSchema, type SignupFormValues } from "@/schemas/auth.schema";
import { useSignup } from "@/hooks/useAuth";

export default function SignupPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const { mutate: handleSignup, isPending } = useSignup();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
  });

  const onSubmit = (data: SignupFormValues) => {
    // confirmPassword is client-only — never sent to the API
    handleSignup({
      name: data.name,
      email: data.email,
      password: data.password,
    });
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
          <h1 className="text-2xl font-bold text-foreground">
            Create your account
          </h1>
          <p className="text-sm text-muted-foreground">
            Join{" "}
            <span className="brand-gradient font-semibold">RoomManager</span>{" "}
            and start managing your groups
          </p>
        </div>

        {/* ── Form ──────────────────────────────────────────────────── */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>

          {/* Full name */}
          <div className="space-y-1.5">
            <Label htmlFor="signup-name">Full name</Label>
            <Input
              id="signup-name"
              type="text"
              autoComplete="name"
              placeholder="Kush Shah"
              className="input-glass"
              aria-invalid={!!errors.name}
              {...register("name")}
            />
            {errors.name && (
              <p className="field-error" role="alert">
                {errors.name.message}
              </p>
            )}
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <Label htmlFor="signup-email">Email address</Label>
            <Input
              id="signup-email"
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
            <Label htmlFor="signup-password">
              Password{" "}
              <span className="text-xs text-muted-foreground font-normal">
                (min 6 characters)
              </span>
            </Label>
            <div className="relative">
              <Input
                id="signup-password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
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

          {/* Confirm password */}
          <div className="space-y-1.5">
            <Label htmlFor="signup-confirm-password">Confirm password</Label>
            <div className="relative">
              <Input
                id="signup-confirm-password"
                type={showConfirm ? "text" : "password"}
                autoComplete="new-password"
                placeholder="••••••••"
                className="input-glass pr-10"
                aria-invalid={!!errors.confirmPassword}
                {...register("confirmPassword")}
              />
              <button
                type="button"
                aria-label={showConfirm ? "Hide confirm password" : "Show confirm password"}
                onClick={() => setShowConfirm((v) => !v)}
                className="pw-toggle"
              >
                {showConfirm ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
            {errors.confirmPassword && (
              <p className="field-error" role="alert">
                {errors.confirmPassword.message}
              </p>
            )}
          </div>

          {/* Submit */}
          <Button
            id="signup-submit"
            type="submit"
            disabled={isPending}
            size="lg"
            className="btn-gradient w-full font-semibold mt-1"
          >
            {isPending ? (
              <>
                <span className="spinner" />
                Creating account…
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4" />
                Create account
              </>
            )}
          </Button>
        </form>

        {/* ── Divider ───────────────────────────────────────────────── */}
        <div className="auth-divider">or</div>

        {/* ── Login link ────────────────────────────────────────────── */}
        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link
            to="/login"
            className="text-primary font-medium hover:opacity-80 transition-opacity underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
