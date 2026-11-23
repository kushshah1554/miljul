import { useState } from "react";
import { Trophy } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserAvatar } from "@/components/ui/user-avatar";
import { useAuthStore } from "@/features/auth/authStore";
import type { LeaderboardPayload } from "@/features/group-overview/group-overview.api";
import { cn } from "@/lib/utils";

const BOARDS = {
  spent: { label: "Most expenses paid", unit: "" },
  fines: { label: "Most fines", unit: "" },
  approved: { label: "Most approved chores", unit: "approved" },
  late: { label: "Most late chores", unit: "late" },
  rejected: { label: "Most rejected chores", unit: "rejected" },
};
type Board = keyof typeof BOARDS;

const monthName = (month: number) =>
  new Date(2000, month - 1).toLocaleString(undefined, { month: "long" });

/** Members ranked by one measure, picked from the dropdown. Equal values share a rank. */
export function Leaderboard({
  data,
  isLoading,
  month,
  onMonthChange,
}: {
  data: LeaderboardPayload;
  isLoading: boolean; // data still belongs to the previously picked period
  month?: number; // 1-12; undefined = the whole year
  onMonthChange: (month?: number) => void;
}) {
  const myUserId = useAuthStore((s) => s.user?.id);
  const [board, setBoard] = useState<Board>("spent");
  const { label, unit } = BOARDS[board];
  const period = data.month ? `${monthName(data.month)} ${data.year}` : String(data.year);

  const ranked = data.members
    .map((m) => ({ user: m.user, value: m[board], amount: Number(m[board]) }))
    .filter((m) => m.amount > 0)
    .sort((a, b) => b.amount - a.amount || a.user.name.localeCompare(b.user.name));
  const top = ranked[0]?.amount ?? 0;

  return (
    <section
      className={cn("surface space-y-4 transition-opacity", isLoading && "opacity-60")}
      aria-busy={isLoading}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Trophy className="size-5" aria-hidden /> Leaderboard {period}
        </h2>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <Label htmlFor="leaderboard-type" className="sr-only">
            Leaderboard type
          </Label>
          <Select value={board} onValueChange={(v) => setBoard(v as Board)}>
            <SelectTrigger id="leaderboard-type" className="w-full sm:w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(BOARDS).map(([value, b]) => (
                <SelectItem key={value} value={value}>
                  {b.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Label htmlFor="leaderboard-month" className="sr-only">
            Leaderboard month
          </Label>
          <Select
            value={month ? String(month) : "year"}
            onValueChange={(v) => onMonthChange(v === "year" ? undefined : Number(v))}
          >
            <SelectTrigger id="leaderboard-month" className="w-full sm:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="year">Whole year</SelectItem>
              {data.months.map((m) => (
                <SelectItem key={m} value={String(m)}>
                  {monthName(m)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {ranked.length === 0 && (
        <p className="text-sm text-muted-foreground">Nothing to rank in {period}.</p>
      )}
      <ol className="space-y-2" aria-label={`${label} in ${period}`}>
        {ranked.map((m) => {
          const rank = 1 + ranked.filter((other) => other.amount > m.amount).length;
          return (
            <li key={m.user.id} className="flex items-center gap-3 rounded-2xl bg-background p-3">
              <span
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                  rank === 1 ? "bg-primary text-primary-foreground" : "bg-muted",
                )}
              >
                {rank}
              </span>
              <UserAvatar user={m.user} fallbackClassName="bg-muted" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="truncate text-sm font-medium">
                    {m.user.name}
                    {m.user.id === myUserId && <span className="text-muted-foreground"> (you)</span>}
                  </p>
                  <p className="shrink-0 font-mono text-sm font-semibold">
                    {m.value} {unit}
                  </p>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${(m.amount / top) * 100}%` }}
                  />
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
