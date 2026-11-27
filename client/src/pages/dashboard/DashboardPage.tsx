import { useState } from "react";
import { Link } from "react-router-dom";
import { Users } from "lucide-react";
import { StatCards, YearSelect } from "@/components/dashboard/DashboardStats";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthStore } from "@/features/auth/authStore";
import { useDashboard } from "@/features/dashboard/useDashboard";

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
          <YearSelect year={year ?? data.year} years={data.years} onYearChange={setYear} />
          <StatCards data={data} isLoading={isPlaceholderData} />
        </>
      )}
    </div>
  );
}
