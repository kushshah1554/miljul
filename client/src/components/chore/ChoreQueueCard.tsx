import { useState } from "react";
import { ArrowDown, ArrowLeftRight, ArrowUp, Check } from "lucide-react";

import { Pill } from "@/components/chore/ChoreBadges";
import { Button } from "@/components/ui/button";
import {
  useMoveInCycle,
  useReorderOriginalQueue,
  useSwapInCycle,
} from "@/features/chore/useChores";
import { formatDateTime } from "@/lib/time";
import type { ChoreDetail } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * This cycle's queue (locked members first, then pending) and the default
 * order the next cycle starts from. Owners can move, swap and reorder.
 */
export function ChoreQueueCard({
  groupId,
  chore,
  names,
  canManage,
  timeZone,
}: {
  groupId: string;
  chore: ChoreDetail;
  names: Map<string, string>;
  canManage: boolean;
  timeZone: string;
}) {
  const move = useMoveInCycle(groupId, chore.id);
  const swap = useSwapInCycle(groupId, chore.id);
  const reorder = useReorderOriginalQueue(groupId, chore.id);
  const [swapping, setSwapping] = useState<string | null>(null);

  const cycle = chore.currentCycle;
  // Queue edits are only allowed while the rotation is running or paused
  const canEditCycle = canManage && (chore.status === "ACTIVE" || chore.status === "PAUSED");
  const busy = move.isPending || swap.isPending || reorder.isPending;
  const away = new Map(chore.participants.map((p) => [p.userId, p.unavailableUntil]));
  const nameOf = (id: string) => names.get(id) ?? "Former member";

  const handleSwap = (userId: string) => {
    if (!swapping) return setSwapping(userId);
    if (swapping !== userId) swap.mutate({ userIdA: swapping, userIdB: userId });
    setSwapping(null);
  };

  const moveOriginal = (index: number, to: number) => {
    const order = [...chore.originalQueue];
    order.splice(to, 0, ...order.splice(index, 1));
    reorder.mutate(order);
  };

  return (
    <section className="surface space-y-4">
      {cycle && (
        <div className="space-y-2">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold">This cycle</h2>
            <span className="text-xs text-muted-foreground">Cycle {cycle.number}</span>
          </div>
          {swapping && (
            <p className="text-xs text-muted-foreground">
              Pick who swaps with {nameOf(swapping)}, or tap them again to cancel.
            </p>
          )}
          <ol className="space-y-1">
            {cycle.order.map((userId, i) => {
              const locked = i < cycle.lockedCount;
              const isCurrent = chore.currentAssignment?.userId === userId && locked;
              const until = away.get(userId);
              return (
                <li
                  key={userId}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl px-3 py-2",
                    swapping === userId ? "bg-primary/10" : "hover:bg-background/60",
                  )}
                >
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-background font-mono text-xs">
                    {locked && !isCurrent ? <Check className="size-4" /> : i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={cn("truncate text-sm font-medium", locked && !isCurrent && "text-muted-foreground")}>
                      {nameOf(userId)}
                    </p>
                    {!locked && until && new Date(until) > new Date() && (
                      <p className="truncate text-xs text-muted-foreground">
                        Away until {formatDateTime(until, timeZone)}
                      </p>
                    )}
                  </div>
                  {isCurrent && <Pill tone="info">Now</Pill>}
                  {canEditCycle && !locked && (
                    <div className="flex shrink-0 gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Move ${nameOf(userId)} earlier`}
                        disabled={busy || i <= cycle.lockedCount}
                        onClick={() => move.mutate({ userId, toIndex: i - 1 })}
                      >
                        <ArrowUp />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Move ${nameOf(userId)} later`}
                        disabled={busy || i >= cycle.order.length - 1}
                        onClick={() => move.mutate({ userId, toIndex: i + 1 })}
                      >
                        <ArrowDown />
                      </Button>
                      <Button
                        variant={swapping === userId ? "default" : "ghost"}
                        size="icon-sm"
                        aria-label={`Swap ${nameOf(userId)}`}
                        aria-pressed={swapping === userId}
                        disabled={busy}
                        onClick={() => handleSwap(userId)}
                      >
                        <ArrowLeftRight />
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      )}

      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Default order</h2>
        <p className="text-xs text-muted-foreground">Every new cycle starts in this order.</p>
        {chore.originalQueue.length === 0 && (
          <p className="text-sm text-muted-foreground">Nobody takes part yet.</p>
        )}
        <ol className="space-y-1">
          {chore.originalQueue.map((userId, i) => (
            <li key={userId} className="flex items-center gap-3 rounded-2xl px-3 py-2 hover:bg-background/60">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-background font-mono text-xs">
                {i + 1}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{nameOf(userId)}</span>
              {canManage && chore.status !== "ARCHIVED" && (
                <div className="flex shrink-0 gap-0.5">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Move ${nameOf(userId)} up`}
                    disabled={busy || i === 0}
                    onClick={() => moveOriginal(i, i - 1)}
                  >
                    <ArrowUp />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Move ${nameOf(userId)} down`}
                    disabled={busy || i === chore.originalQueue.length - 1}
                    onClick={() => moveOriginal(i, i + 1)}
                  >
                    <ArrowDown />
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
