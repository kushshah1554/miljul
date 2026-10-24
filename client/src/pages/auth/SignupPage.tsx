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
    <div className="w-full md:w-1/2 flex flex-col p-8 sm:p-12 lg:p-16">
      <div className="text-right mb-8">
        <span className="text-sm text-slate-500">
          Already have an account?{" "}
        </span>
        <Link
          to="/login"
          className="text-sm font-semibold text-indigo-600 hover:text-indigo-700 transition-colors"
        >
          Sign in
        </Link>
      </div>

      <div className="max-w-md w-full mx-auto flex-1 flex flex-col justify-center">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-slate-900 mb-2 flex items-center gap-2">
            Create an account <span className="text-2xl">✨</span>
          </h2>
          <p className="text-slate-500">Enter your details to get started</p>
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
              className="text-sm font-medium text-slate-700"
            >
              Full name
            </Label>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
              <Input
                id="signup-name"
                type="text"
                autoComplete="name"
                placeholder="Kush Shah"
                className="pl-11 h-12 rounded-xl border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-0"
                aria-invalid={!!errors.name}
                {...register("name")}
              />
            </div>
            {errors.name && (
              <p className="text-sm text-red-500">{errors.name.message}</p>
            )}
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label
              htmlFor="signup-email"
              className="text-sm font-medium text-slate-700"
            >
              Email address
            </Label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
              <Input
                id="signup-email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                className="pl-11 h-12 rounded-xl border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-0"
                aria-invalid={!!errors.email}
                {...register("email")}
              />
            </div>
            {errors.email && (
              <p className="text-sm text-red-500">{errors.email.message}</p>
            )}
          </div>

          {/* Password */}
          <div className="space-y-2">
            <Label
              htmlFor="signup-password"
              className="text-sm font-medium text-slate-700 flex justify-between"
            >
              Password
              <span className="text-xs font-normal text-slate-500">
                (min 6 characters)
              </span>
            </Label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
              <Input
                id="signup-password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Create a password"
                className="pl-11 pr-11 h-12 rounded-xl border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-0"
                aria-invalid={!!errors.password}
                {...register("password")}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
            {errors.password && (
              <p className="text-sm text-red-500">{errors.password.message}</p>
            )}
          </div>

          {/* Confirm Password */}
          <div className="space-y-2">
            <Label
              htmlFor="signup-confirm-password"
              className="text-sm font-medium text-slate-700"
            >
              Confirm password
            </Label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
              <Input
                id="signup-confirm-password"
                type={showConfirm ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Confirm your password"
                className="pl-11 pr-11 h-12 rounded-xl border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-0"
                aria-invalid={!!errors.confirmPassword}
                {...register("confirmPassword")}
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showConfirm ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
            {errors.confirmPassword && (
              <p className="text-sm text-red-500">
                {errors.confirmPassword.message}
              </p>
            )}
          </div>

          <Button
            type="submit"
            disabled={isPending}
            className="w-full h-12 rounded-xl bg-[#3b41e3] hover:bg-[#3237c5] text-white font-medium text-base mt-2 transition-colors"
          >
            {isPending ? (
              "Creating account..."
            ) : (
              <>
                Create account <ArrowRight className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
        </form>

        <div className="flex items-center gap-4 my-6">
          <div className="flex-1 border-t border-slate-200" />
          <span className="text-sm text-slate-400">or</span>
          <div className="flex-1 border-t border-slate-200" />
        </div>

        <Button
          variant="outline"
          className="w-full h-12 rounded-xl border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium transition-colors"
        >
          <GoogleIcon className="w-5 h-5 mr-3" />
          Sign up with Google
        </Button>
      </div>
    </div>
  );
}
