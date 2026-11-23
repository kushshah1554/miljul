import { useState } from "react";
import { Link } from "react-router-dom";
import { CircleCheck, CircleX, Clock, Receipt, TriangleAlert, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthStore } from "@/features/auth/authStore";
import type { DashboardTotals } from "@/features/dashboard/dashboard.api";
import { useDashboard } from "@/features/dashboard/useDashboard";
import { cn } from "@/lib/utils";

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const [year, setYear] = useState<number>(); // undefined = current year
  const { data, isPending, isError, error, refetch, isPlaceholderData } = useDashboard(year);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 px-4 py-6 md:px-6 md:py-10">
      <section className="surface surface-glow flex flex-wrap items-center justify-between gap-6 p-6 md:p-8">
        <div className="min-w-0 space-y-1">
          <h1 className="text-2xl font-bold tracking-tight wrap-break-word md:text-3xl">
            Welcome, {user?.name ?? "User"}!
          </h1>
          <p className="text-muted-foreground">Your totals across all groups</p>
        </div>
        <div className="flex items-center gap-5">
          <dl className="flex flex-col-reverse">
            <dt className="text-sm text-muted-foreground">Groups joined</dt>
            <dd className="text-4xl font-bold">{data?.groupsJoined ?? "–"}</dd>
          </dl>
          <Button asChild>
            <Link to="/groups">
              <Users /> Your groups
            </Link>
          </Button>
        </div>
      </section>

      {isPending && (
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-56 w-full" />
          <Skeleton className="h-56 w-full" />
        </div>
      )}
      {isError && (
        <section className="surface flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-destructive">{error.message}</p>
          <Button variant="outline" onClick={() => refetch()}>
            Try again
          </Button>
        </section>
      )}

      {data && (
        <>
          <div className="flex items-center justify-end gap-3">
            <Label htmlFor="dashboard-year">Year</Label>
            <Select value={String(year ?? data.year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger id="dashboard-year" className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {data.years.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y === data.years[0] ? `This year (${y})` : y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div
            className={cn("space-y-4 transition-opacity", isPlaceholderData && "opacity-60")}
            aria-busy={isPlaceholderData}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <MoneyCard title="Money spent" icon={Receipt} year={data.year} totals={data.spent} />
              <MoneyCard
                title="Fines"
                icon={TriangleAlert}
                iconClass="text-destructive"
                year={data.year}
                totals={data.fines}
              />
            </div>

            <section className="surface space-y-4">
              <h2 className="text-lg font-semibold">Chores in {data.year}</h2>
              <dl className="grid gap-3 sm:grid-cols-3">
                <ChoreTile
                  label="Approved"
                  hint="On time, no fine"
                  value={data.chores.approved}
                  icon={CircleCheck}
                  iconClass="text-success"
                />
                <ChoreTile
                  label="Late"
                  hint="Done after the deadline"
                  value={data.chores.late}
                  icon={Clock}
                />
                <ChoreTile
                  label="Rejected"
                  hint="Work not accepted"
                  value={data.chores.rejected}
                  icon={CircleX}
                  iconClass="text-destructive"
                />
              </dl>
            </section>
          </div>
        </>
      )}
    </div>
  );
}

function MoneyCard({
  title,
  icon: Icon,
  iconClass,
  year,
  totals,
}: {
  title: string;
  icon: LucideIcon;
  iconClass?: string;
  year: number;
  totals: DashboardTotals;
}) {
  return (
    <section className="surface space-y-4">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <Icon className={cn("size-5", iconClass)} aria-hidden /> {title}
      </h2>
      <dl className="space-y-4">
        <div>
          <dt className="text-sm text-muted-foreground">{totals.today !== null ? "Today" : `Total in ${year}`}</dt>
          <dd className="font-mono text-3xl font-bold wrap-anywhere">{totals.today ?? totals.year}</dd>
        </div>
        {totals.month !== null && (
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-background p-4">
              <dt className="text-sm text-muted-foreground">This month</dt>
              <dd className="font-mono text-lg font-semibold wrap-anywhere">{totals.month}</dd>
            </div>
            <div className="rounded-2xl bg-background p-4">
              <dt className="text-sm text-muted-foreground">This year</dt>
              <dd className="font-mono text-lg font-semibold wrap-anywhere">{totals.year}</dd>
            </div>
          </div>
        )}
      </dl>
    </section>
  );
}

function ChoreTile({
  label,
  hint,
  value,
  icon: Icon,
  iconClass,
}: {
  label: string;
  hint: string;
  value: number;
  icon: LucideIcon;
  iconClass?: string;
}) {
  return (
    <div className="rounded-2xl bg-background p-4">
      <dt className="flex items-center gap-2 text-sm font-medium">
        <Icon className={cn("size-4", iconClass)} aria-hidden /> {label}
      </dt>
      <dd className="mt-2 text-3xl font-bold">{value}</dd>
      <dd className="text-xs text-muted-foreground">{hint}</dd>
    </div>
  );
}
