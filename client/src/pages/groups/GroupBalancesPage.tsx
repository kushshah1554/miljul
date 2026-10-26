import { ArrowRight } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { useAuthStore } from "@/features/auth/authStore";
import { useGroupBalances, useMyBalance } from "@/features/balance/useBalances";
import { cn } from "@/lib/utils";
import { useCurrentGroup } from "@/pages/groups/GroupLayout";

/** Positive = owed money (green), negative = owes money (red). */
function balanceTone(net: string) {
  const n = Number(net);
  return n > 0 ? "text-emerald-600 dark:text-emerald-400" : n < 0 ? "text-destructive" : "";
}

export default function GroupBalancesPage() {
  const group = useCurrentGroup();
  const myUserId = useAuthStore((s) => s.user?.id ?? "");
  const mine = useMyBalance(group.id);
  const all = useGroupBalances(group.id);

  const net = mine.data ? Number(mine.data.netBalance) : 0;

  return (
    <>
      <section className="rounded-xl border border-border p-4 space-y-2">
        <h2 className="font-semibold">Your balance</h2>
        {mine.isPending && <Skeleton className="h-10 w-40" />}
        {mine.isError && <p className="text-sm text-destructive">{mine.error.message}</p>}
        {mine.data && (
          <>
            <p className={cn("font-mono text-2xl font-semibold", balanceTone(mine.data.netBalance))}>
              {mine.data.netBalance}
            </p>
            <p className="text-sm text-muted-foreground">
              {net > 0 ? "You are owed money." : net < 0 ? "You owe money." : "You are settled up."}{" "}
              Paid {mine.data.totalPaid} · your share {mine.data.totalShares}
            </p>
          </>
        )}
      </section>

      <section className="rounded-xl border border-border p-4 space-y-3">
        <h2 className="font-semibold">Suggested settlements</h2>
        {all.isPending && <Skeleton className="h-12 w-full" />}
        {all.isError && <p className="text-sm text-destructive">{all.error.message}</p>}
        {all.data?.suggestedSettlements.length === 0 && (
          <p className="text-sm text-muted-foreground">Everyone is settled up.</p>
        )}
        <ul className="divide-y divide-border">
          {all.data?.suggestedSettlements.map((s) => (
            <li key={`${s.fromUserId}-${s.toUserId}`} className="flex items-center gap-2 py-3 text-sm">
              <span className="min-w-0 truncate font-medium">
                {s.fromUserId === myUserId ? "You" : s.fromName}
              </span>
              <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate font-medium">
                {s.toUserId === myUserId ? "You" : s.toName}
              </span>
              <span className="shrink-0 font-mono">{s.amount}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-border p-4 space-y-3">
        <h2 className="font-semibold">All members</h2>
        {all.isPending && <Skeleton className="h-24 w-full" />}
        <ul className="divide-y divide-border">
          {all.data?.balances.map((b) => (
            <li key={b.userId} className="flex items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {b.name}
                  {b.userId === myUserId && <span className="text-muted-foreground"> (you)</span>}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  Paid {b.totalPaid} · share {b.totalShares}
                </p>
              </div>
              <span className={cn("shrink-0 font-mono text-sm font-medium", balanceTone(b.netBalance))}>
                {b.netBalance}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
