import { CircleCheck, CircleX, Clock, Receipt, TriangleAlert } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { DashboardPayload, DashboardTotals } from "@/features/dashboard/dashboard.api";
import { cn } from "@/lib/utils";

/** Year dropdown shared by the dashboard and a group's overview. */
export function YearSelect({
  year,
  years,
  onYearChange,
}: {
  year: number;
  years: number[]; // newest first; years[0] is the current year
  onYearChange: (year: number) => void;
}) {
  return (
    <div className="flex items-center justify-end gap-3">
      <Label htmlFor="dashboard-year">Year</Label>
      <Select value={String(year)} onValueChange={(v) => onYearChange(Number(v))}>
        <SelectTrigger id="dashboard-year" className="w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {years.map((y) => (
            <SelectItem key={y} value={String(y)}>
              {y === years[0] ? `This year (${y})` : y}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** Money, fines and chores cards of one year. */
export function StatCards({
  data,
  isLoading = false,
}: {
  data: Pick<DashboardPayload, "year" | "spent" | "fines" | "chores">;
  isLoading?: boolean; // data still belongs to the previously picked year
}) {
  return (
    <div
      className={cn("space-y-4 transition-opacity", isLoading && "opacity-60")}
      aria-busy={isLoading}
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
