import { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Eye,
  EyeOff,
  Mail,
  Lock,
  ArrowRight,
  Users,
  ShieldCheck,
  Zap,
  Mountain,
  User,
} from "lucide-react";

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
    /* ── Main Container (Full Screen) ──────────────────────────────────────── */
    <div className="min-h-screen w-full flex bg-white">
      {/* ── Left Panel (Image & Features - 50% width) ──────────────────────── */}
      {/* Hidden on mobile, visible on medium screens and up */}
      <div className="hidden md:flex md:w-1/2 relative flex-col justify-between p-12 lg:p-16 text-white overflow-hidden">
        {/* Background Image */}
        <img
          src="/imgs/mountain.jpg" // ← replace with your image path later
          alt="Mountain landscape"
          className="absolute inset-0 z-0 w-full h-full object-cover"
        />
        {/* Gradient Overlay */}
        <div className="absolute inset-0 z-0 bg-gradient-to-b from-slate-900/40 via-slate-900/60 to-slate-900/95" />

        {/* Content (z-10 to sit above background) */}
        <div className="relative z-10">
          {/* Logo */}
          <div className="flex items-center gap-2 mb-16">
            <Mountain className="w-8 h-8" />
            <span className="text-2xl font-bold tracking-tight">Miljul</span>
          </div>

          {/* Hero Text */}
          <h1 className="text-4xl lg:text-5xl font-bold leading-tight mb-6">
            Better together,
            <br />
            <span className="text-indigo-300">simpler</span> always.
          </h1>
          <p className="text-slate-300 text-lg max-w-md leading-relaxed">
            Manage your shared expenses, keep track of what you owe and what
            you're owed — all in one place.
          </p>
        </div>

        {/* Features List */}
        <div className="relative z-10 space-y-6 mt-12">
          {/* Feature 1 */}
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-full bg-white/10 backdrop-blur-sm border border-white/10">
              <Users className="w-5 h-5 text-indigo-200" />
            </div>
            <div>
              <h3 className="font-semibold text-white">
                Keep everyone in sync
              </h3>
              <p className="text-sm text-slate-400 mt-1">
                Track expenses and balances with your group.
              </p>
            </div>
          </div>
          {/* Feature 2 */}
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-full bg-white/10 backdrop-blur-sm border border-white/10">
              <ShieldCheck className="w-5 h-5 text-indigo-200" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Secure & private</h3>
              <p className="text-sm text-slate-400 mt-1">
                Your data stays safe and protected.
              </p>
            </div>
          </div>
          {/* Feature 3 */}
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-full bg-white/10 backdrop-blur-sm border border-white/10">
              <Zap className="w-5 h-5 text-indigo-200" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Simple to use</h3>
              <p className="text-sm text-slate-400 mt-1">
                Get started in seconds, not hours.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right Panel (Signup Form - 50% width) ──────────────────────────── */}
      <div className="w-full md:w-1/2 flex flex-col p-8 sm:p-12 lg:p-16">
        {/* Top Right Login Link */}
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

        {/* Centered Form Container */}
        <div className="max-w-md w-full mx-auto flex-1 flex flex-col justify-center">
          {/* Header */}
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-slate-900 mb-2 flex items-center gap-2">
              Create an account <span className="text-2xl">✨</span>
            </h2>
            <p className="text-slate-500">Enter your details to get started</p>
          </div>

          {/* Form */}
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
                  className="pl-11 h-12 rounded-xl border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
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
                  className="pl-11 h-12 rounded-xl border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
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
                  className="pl-11 pr-11 h-12 rounded-xl border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
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
                <p className="text-sm text-red-500">
                  {errors.password.message}
                </p>
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
                  className="pl-11 pr-11 h-12 rounded-xl border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
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

            {/* Submit Button */}
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

          {/* Divider */}
          <div className="flex items-center gap-4 my-6">
            <div className="flex-1 border-t border-slate-200"></div>
            <span className="text-sm text-slate-400">or</span>
            <div className="flex-1 border-t border-slate-200"></div>
          </div>

          {/* Google Signup */}
          <Button
            variant="outline"
            className="w-full h-12 rounded-xl border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium transition-colors"
          >
            <GoogleIcon className="w-5 h-5 mr-3" />
            Sign up with Google
          </Button>
        </div>
      </div>
    </div>
  );
}

// Custom Google SVG Icon since Lucide doesn't have brand logos
function GoogleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" {...props}>
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}
