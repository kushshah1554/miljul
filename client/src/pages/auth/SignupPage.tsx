import { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Mail, Lock, ArrowRight, User } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  signupSchema,
  type SignupFormValues,
} from "@/features/auth/auth.schema";
import { useSignup } from "@/features/auth/useAuth";
import { GoogleIcon } from "../../components/auth/GoogleIcon";

// Soft grey pill fields, matching the app's cards
const FIELD = "h-12 rounded-2xl border-transparent bg-card pl-11 shadow-none";

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
    handleSignup({
      name: data.name,
      email: data.email,
      password: data.password,
    });
  };

  return (
    <div className="flex w-full flex-col px-6 py-8 sm:px-12 md:w-1/2 lg:px-16">
      <div className="text-right mb-8">
        <span className="text-sm text-muted-foreground">
          Already have an account?{" "}
        </span>
        <Link
          to="/login"
          className="text-sm font-semibold text-foreground underline-offset-4 hover:underline"
        >
          Sign in
        </Link>
      </div>

      <div className="max-w-md w-full mx-auto flex-1 flex flex-col justify-center">
        <div className="mb-8">
          <h2 className="mb-2 flex items-center gap-2 text-4xl font-bold tracking-tight">
            Create an account <span className="text-2xl">✨</span>
          </h2>
          <p className="text-muted-foreground">Enter your details to get started</p>
        </div>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-4"
          noValidate
        >
          {/* Full Name */}
          <div className="space-y-2">
            <Label
              htmlFor="signup-name"
              className="text-sm font-semibold"
            >
              Full name
            </Label>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 size-5 text-muted-foreground pointer-events-none" />
              <Input
                id="signup-name"
                type="text"
                autoComplete="name"
                placeholder="Kush Shah"
                className={FIELD}
                aria-invalid={!!errors.name}
                {...register("name")}
              />
            </div>
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label
              htmlFor="signup-email"
              className="text-sm font-semibold"
            >
              Email address
            </Label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 size-5 text-muted-foreground pointer-events-none" />
              <Input
                id="signup-email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                className={FIELD}
                aria-invalid={!!errors.email}
                {...register("email")}
              />
            </div>
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email.message}</p>
            )}
          </div>

          {/* Password */}
          <div className="space-y-2">
            <Label
              htmlFor="signup-password"
              className="flex justify-between text-sm font-semibold"
            >
              Password
              <span className="text-xs font-normal text-muted-foreground">
                (min 6 characters)
              </span>
            </Label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 size-5 text-muted-foreground pointer-events-none" />
              <Input
                id="signup-password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Create a password"
                className={`${FIELD} pr-11`}
                aria-invalid={!!errors.password}
                {...register("password")}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
            {errors.password && (
              <p className="text-sm text-destructive">{errors.password.message}</p>
            )}
          </div>

          {/* Confirm Password */}
          <div className="space-y-2">
            <Label
              htmlFor="signup-confirm-password"
              className="text-sm font-semibold"
            >
              Confirm password
            </Label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 size-5 text-muted-foreground pointer-events-none" />
              <Input
                id="signup-confirm-password"
                type={showConfirm ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Confirm your password"
                className={`${FIELD} pr-11`}
                aria-invalid={!!errors.confirmPassword}
                {...register("confirmPassword")}
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                aria-label={showConfirm ? "Hide password" : "Show password"}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showConfirm ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
            {errors.confirmPassword && (
              <p className="text-sm text-destructive">
                {errors.confirmPassword.message}
              </p>
            )}
          </div>

          <Button
            type="submit"
            disabled={isPending}
            size="lg"
            className="mt-4 h-12 w-full"
          >
            {isPending ? (
              "Creating account..."
            ) : (
              <>
                Create account <ArrowRight />
              </>
            )}
          </Button>
        </form>

        <div className="flex items-center gap-4 my-6">
          <div className="flex-1 border-t border-border" />
          <span className="text-sm text-muted-foreground">or</span>
          <div className="flex-1 border-t border-border" />
        </div>

        <Button
          variant="outline"
          className="h-12 w-full"
        >
          <GoogleIcon className="size-5" />
          Sign up with Google
        </Button>
      </div>
    </div>
  );
}
