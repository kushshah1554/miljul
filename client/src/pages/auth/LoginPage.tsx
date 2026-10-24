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
    <div className="w-full md:w-1/2 flex flex-col p-8 sm:p-12 lg:p-16">
      <div className="text-right mb-8">
        <span className="text-sm text-slate-500">Don't have an account? </span>
        <Link
          to="/signup"
          className="text-sm font-semibold text-indigo-600 hover:text-indigo-700 transition-colors"
        >
          Sign up
        </Link>
      </div>

      <div className="max-w-md w-full mx-auto flex-1 flex flex-col justify-center">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-slate-900 mb-2 flex items-center gap-2">
            Welcome back <span className="text-2xl">👋</span>
          </h2>
          <p className="text-slate-500">Sign in to your account to continue</p>
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
              className="text-sm font-medium text-slate-700"
            >
              Email address
            </Label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
              <Input
                id="email"
                type="email"
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
              htmlFor="password"
              className="text-sm font-medium text-slate-700"
            >
              Password
            </Label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
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

          {/* Remember Me & Forgot Password */}
          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="remember"
                className="border-slate-300 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600"
              />
              <label
                htmlFor="remember"
                className="text-sm font-medium leading-none text-slate-600"
              >
                Remember me
              </label>
            </div>
            <Link
              to="#"
              className="text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
            >
              Forgot password?
            </Link>
          </div>

          <Button
            type="submit"
            disabled={isPending}
            className="w-full h-12 rounded-xl bg-[#3b41e3] hover:bg-[#3237c5] text-white font-medium text-base mt-4 transition-colors"
          >
            {isPending ? (
              "Signing in..."
            ) : (
              <>
                Sign in <ArrowRight className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
        </form>

        <div className="flex items-center gap-4 my-8">
          <div className="flex-1 border-t border-slate-200" />
          <span className="text-sm text-slate-400">or</span>
          <div className="flex-1 border-t border-slate-200" />
        </div>

        <Button
          variant="outline"
          className="w-full h-12 rounded-xl border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium transition-colors"
        >
          <GoogleIcon className="w-5 h-5 mr-3" />
          Continue with Google
        </Button>
      </div>
    </div>
  );
}
