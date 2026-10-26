import { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Mail, Lock, ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

import { loginSchema, type LoginFormValues } from "@/features/auth/auth.schema";
import { useLogin } from "@/features/auth/useAuth";
import { GoogleIcon } from "../../components/auth/GoogleIcon";

// Soft grey pill fields, matching the app's cards
const FIELD = "h-12 rounded-2xl border-transparent bg-card pl-11 shadow-none";

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
    <div className="flex w-full flex-col px-6 py-8 sm:px-12 md:w-1/2 lg:px-16">
      <div className="text-right mb-8">
        <span className="text-sm text-muted-foreground">Don't have an account? </span>
        <Link
          to="/signup"
          className="text-sm font-semibold text-foreground underline-offset-4 hover:underline"
        >
          Sign up
        </Link>
      </div>

      <div className="max-w-md w-full mx-auto flex-1 flex flex-col justify-center">
        <div className="mb-8">
          <h2 className="mb-2 flex items-center gap-2 text-4xl font-bold tracking-tight">
            Welcome back <span className="text-2xl">👋</span>
          </h2>
          <p className="text-muted-foreground">Sign in to your account to continue</p>
        </div>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-5"
          noValidate
        >
          {/* Email */}
          <div className="space-y-2">
            <Label
              htmlFor="email"
              className="text-sm font-semibold"
            >
              Email address
            </Label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 size-5 text-muted-foreground pointer-events-none" />
              <Input
                id="email"
                type="email"
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
              htmlFor="password"
              className="text-sm font-semibold"
            >
              Password
            </Label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 size-5 text-muted-foreground pointer-events-none" />
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
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

          {/* Remember Me & Forgot Password */}
          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center space-x-2">
              <Checkbox id="remember" />
              <label
                htmlFor="remember"
                className="text-sm leading-none font-medium text-muted-foreground"
              >
                Remember me
              </label>
            </div>
            <Link
              to="#"
              className="text-sm font-semibold text-foreground underline-offset-4 hover:underline"
            >
              Forgot password?
            </Link>
          </div>

          <Button
            type="submit"
            disabled={isPending}
            size="lg"
            className="mt-4 h-12 w-full"
          >
            {isPending ? (
              "Signing in..."
            ) : (
              <>
                Sign in <ArrowRight />
              </>
            )}
          </Button>
        </form>

        <div className="flex items-center gap-4 my-8">
          <div className="flex-1 border-t border-border" />
          <span className="text-sm text-muted-foreground">or</span>
          <div className="flex-1 border-t border-border" />
        </div>

        <Button
          variant="outline"
          className="h-12 w-full"
        >
          <GoogleIcon className="size-5" />
          Continue with Google
        </Button>
      </div>
    </div>
  );
}
