import { Mountain, Users, ShieldCheck, Zap } from "lucide-react";

export default function AuthLeftPanel() {
  return (
    <div className="hidden md:flex md:w-1/2 relative flex-col justify-between p-12 lg:p-16 text-white overflow-hidden">
      {/* Background Image */}
      <img
        src="/imgs/mountain.jpg"
        alt="Mountain landscape"
        className="absolute inset-0 z-0 w-full h-full object-cover"
      />
      {/* Gradient Overlay */}
      <div className="absolute inset-0 z-0 bg-linear-to-b from-slate-900/40 via-slate-900/60 to-slate-900/95" />

      {/* Content */}
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
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-full bg-white/10 backdrop-blur-sm border border-white/10">
            <Users className="w-5 h-5 text-indigo-200" />
          </div>
          <div>
            <h3 className="font-semibold text-white">Keep everyone in sync</h3>
            <p className="text-sm text-slate-400 mt-1">
              Track expenses and balances with your group.
            </p>
          </div>
        </div>

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
  );
}
