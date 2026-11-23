import { useState } from "react";
import { CalendarDays, Trophy, User, Users } from "lucide-react";
import { Tabs } from "radix-ui";
import { StatCards, YearSelect } from "@/components/dashboard/DashboardStats";
import { Leaderboard } from "@/components/group/Leaderboard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useGroupLeaderboard, useGroupOverview } from "@/features/group-overview/useGroupOverview";
import { useCurrentGroup } from "@/pages/groups/GroupLayout";

const TABS = [
  { value: "mine", label: "My summary", icon: User },
  { value: "group", label: "Whole group", icon: Users },
  { value: "leaderboard", label: "Leaderboard", icon: Trophy },
] as const;

const contentClass = "rounded-3xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

export default function GroupOverviewPage() {
  const group = useCurrentGroup();
  const [year, setYear] = useState<number>(); // undefined = current year
  const [month, setMonth] = useState<number>(); // undefined = whole year
  const overview = useGroupOverview(group.id, year);
  const { data } = overview;

  return (
    <div className="space-y-4">
      <section className="surface surface-glow flex flex-wrap items-center justify-between gap-6 p-6 md:p-8">
        <div className="min-w-0 space-y-1">
          <h2 className="text-lg font-semibold">About</h2>
          <p className="text-muted-foreground wrap-break-word">
            {group.description || "No description."}
          </p>
          <p className="flex items-center gap-1 text-sm text-muted-foreground">
            <CalendarDays className="size-4" /> Created{" "}
            {new Date(group.createdAt).toLocaleDateString()}
          </p>
        </div>
        <dl className="flex flex-col-reverse">
          <dt className="text-sm text-muted-foreground">
            Member{group.memberCount === 1 ? "" : "s"}
          </dt>
          <dd className="text-4xl font-bold">{group.memberCount}</dd>
        </dl>
      </section>

      {overview.isPending && (
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-56 w-full" />
          <Skeleton className="h-56 w-full" />
        </div>
      )}
      {overview.isError && <LoadError error={overview.error} onRetry={() => overview.refetch()} />}

      {data && (
        <Tabs.Root defaultValue="mine" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Tabs.List
              aria-label="Whose totals"
              className="flex max-w-full gap-1 overflow-x-auto rounded-full bg-card p-1"
            >
              {TABS.map(({ value, label, icon: Icon }) => (
                <Tabs.Trigger
                  key={value}
                  value={value}
                  className="flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground sm:px-4"
                >
                  <Icon className="hidden size-4 sm:block" aria-hidden /> {label}
                </Tabs.Trigger>
              ))}
            </Tabs.List>
            <YearSelect
              year={year ?? data.year}
              years={data.years}
              onYearChange={(y) => {
                setYear(y);
                setMonth(undefined); // the picked month may not exist in the new year yet
              }}
            />
          </div>

          {(["mine", "group"] as const).map((tab) => (
            <Tabs.Content key={tab} value={tab} className={contentClass}>
              <StatCards
                data={{ year: data.year, ...data[tab] }}
                isLoading={overview.isPlaceholderData}
              />
            </Tabs.Content>
          ))}
          <Tabs.Content value="leaderboard" className={contentClass}>
            <LeaderboardTab
              groupId={group.id}
              year={year ?? data.year}
              month={month}
              onMonthChange={setMonth}
            />
          </Tabs.Content>
        </Tabs.Root>
      )}
    </div>
  );
}

/** Mounted only while its tab is open, so the leaderboard loads on demand. */
function LeaderboardTab({
  groupId,
  year,
  month,
  onMonthChange,
}: {
  groupId: string;
  year: number;
  month?: number;
  onMonthChange: (month?: number) => void;
}) {
  const { data, isPending, isError, error, refetch, isPlaceholderData } = useGroupLeaderboard(
    groupId,
    year,
    month,
  );

  return (
    <div className="space-y-4">
      {isPending && <Skeleton className="h-72 w-full" />}
      {isError && <LoadError error={error} onRetry={() => refetch()} />}
      {data && (
        <Leaderboard
          data={data}
          isLoading={isPlaceholderData}
          month={month}
          onMonthChange={onMonthChange}
        />
      )}
    </div>
  );
}

function LoadError({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <section className="surface flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-destructive">{error.message}</p>
      <Button variant="outline" onClick={onRetry}>
        Try again
      </Button>
    </section>
  );
}
