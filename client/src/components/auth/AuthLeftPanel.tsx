import { Mountain, Users, ShieldCheck, Zap } from "lucide-react";

const PILLS = [
  { icon: Users, label: "Groups" },
  { icon: ShieldCheck, label: "Private" },
  { icon: Zap, label: "Instant" },
];

export default function AuthLeftPanel() {
  return (
    <div className="relative hidden flex-col justify-between overflow-hidden rounded-[2rem] p-6 md:flex md:w-1/2 lg:p-8">
      <img
        src="/imgs/mountain.jpg"
        alt=""
        className="absolute inset-0 z-0 h-full w-full object-cover"
      />
      {/* Darken only the bottom so the headline stays readable */}
      <div className="absolute inset-0 z-0 bg-linear-to-b from-black/5 via-black/10 to-black/70" />

      {/* Top row: brand chip + frosted feature pills */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-3">
        <span className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm">
          <Mountain className="size-4" /> Miljul
        </span>
        <div className="flex flex-wrap gap-2">
          {PILLS.map(({ icon: Icon, label }) => (
            <span
              key={label}
              className="flex items-center gap-2 rounded-full bg-white/60 px-4 py-2 text-sm font-medium text-slate-900 backdrop-blur-md"
            >
              <Icon className="size-4" /> {label}
            </span>
          ))}
        </div>
      </div>

      {/* Bottom: headline */}
      <div className="relative z-10 space-y-4 text-white">
        <h1 className="text-4xl leading-tight font-bold tracking-tight lg:text-5xl">
          Better together,
          <br />
          simpler always.
        </h1>
        <p className="max-w-md text-lg leading-relaxed text-white/80">
          Manage shared expenses, keep track of what you owe and what you're
          owed — all in one place.
        </p>
      </div>
    </div>
  );
}
