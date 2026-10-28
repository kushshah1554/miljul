import { useState } from "react";
import { HandCoins } from "lucide-react";

import { AssignmentSheet, type AssignmentRef } from "@/components/chore/AssignmentSheet";
import { Pill } from "@/components/chore/ChoreBadges";
import { ReasonForm } from "@/components/chore/ReasonForm";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";

import { useAuthStore } from "@/features/auth/authStore";
import type { ListFinesQuery } from "@/features/chore-fine/chore-fine.api";
import { useFines, useFineSummary, useVoidFine } from "@/features/chore-fine/useChoreFines";
import { isOwner } from "@/lib/roles";
import { formatDateTime } from "@/lib/time";
import type { ChoreFine, Group } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useCurrentGroup } from "@/pages/groups/GroupLayout";

/** Positive = others owe you (green), negative = you owe (red). Same as balances. */
function netTone(net: string) {
  const n = Number(net);
  return n > 0 ? "text-success" : n < 0 ? "text-destructive" : "";
}

const PAGE_SIZE = 8;

type Scope = "all" | "owe" | "owed";

export default function GroupChoreFinesPage() {
  const group = useCurrentGroup();
  const myUserId = useAuthStore((s) => s.user?.id ?? "");
  const summary = useFineSummary(group.id);
  const [scope, setScope] = useState<Scope>("all");
  const [showVoided, setShowVoided] = useState(false);
  const [viewing, setViewing] = useState<AssignmentRef | null>(null);

  const me = summary.data?.find((m) => m.user.id === myUserId);
  const query: ListFinesQuery = {
    status: showVoided ? undefined : "ACTIVE",
    payerId: scope === "owe" ? myUserId : undefined,
    recipientId: scope === "owed" ? myUserId : undefined,
  };

  return (
    <>
      <section className="surface surface-glow space-y-2">
        <h2 className="text-lg font-semibold">Your chore fines</h2>
        {summary.isPending && <Skeleton className="h-10 w-40" />}
        {summary.isError && <p className="text-sm text-destructive">{summary.error.message}</p>}
        {summary.data && (
          <>
            <p className={cn("font-mono text-3xl font-bold", netTone(me?.net ?? "0"))}>
              {me?.net ?? "0.00"}
            </p>
            <p className="text-sm text-muted-foreground">
              You owe {me?.totalOwed ?? "0.00"} · you are owed {me?.totalReceivable ?? "0.00"}. Fines
              are separate from expense balances.
            </p>
          </>
        )}
      </section>

      <section className="surface space-y-3">
        <h2 className="text-lg font-semibold">All members</h2>
        {summary.isPending && <Skeleton className="h-24 w-full" />}
        {summary.data?.length === 0 && (
          <p className="text-sm text-muted-foreground">No active fines.</p>
        )}
        <ul className="space-y-1">
          {summary.data?.map((m) => (
            <li key={m.user.id} className="flex items-center gap-3 rounded-2xl px-3 py-3 hover:bg-background/60">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {m.user.name}
                  {m.user.id === myUserId && <span className="text-muted-foreground"> (you)</span>}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  Owes {m.totalOwed} · owed {m.totalReceivable}
                </p>
              </div>
              <span className={cn("shrink-0 font-mono text-sm font-medium", netTone(m.net))}>
                {m.net}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="surface space-y-3">
        <h2 className="text-lg font-semibold">Fines</h2>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["all", "All"],
              ["owe", "I pay"],
              ["owed", "I receive"],
            ] as const
          ).map(([value, label]) => (
            <Button
              key={value}
              size="sm"
              variant={scope === value ? "default" : "outline"}
              onClick={() => setScope(value)}
            >
              {label}
            </Button>
          ))}
          <Button
            size="sm"
            variant={showVoided ? "default" : "outline"}
            className="ml-auto"
            aria-pressed={showVoided}
            onClick={() => setShowVoided((v) => !v)}
          >
            Include voided
          </Button>
        </div>

        {/* key: a new filter remounts the list, resetting it to page 1 */}
        <FineList
          key={`${scope}|${showVoided}`}
          group={group}
          query={query}
          onOpenAssignment={setViewing}
        />
      </section>

      <AssignmentSheet group={group} target={viewing} onClose={() => setViewing(null)} />
    </>
  );
}

function FineList({
  group,
  query,
  onOpenAssignment,
}: {
  group: Group;
  query: ListFinesQuery;
  onOpenAssignment: (ref: AssignmentRef) => void;
}) {
  const [page, setPage] = useState(1);
  const { data, isPending, isError, error, isPlaceholderData } = useFines(group.id, {
    ...query,
    page,
    limit: PAGE_SIZE,
  });

  return (
    <>
      {isPending && (
        <div className="space-y-2">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      )}
      {isError && <p className="text-sm text-destructive">{error.message}</p>}
      {data?.fines.length === 0 && <p className="text-sm text-muted-foreground">No fines.</p>}

      <ul className="space-y-1">
        {data?.fines.map((fine) => (
          <FineRow key={fine.id} group={group} fine={fine} onOpenAssignment={onOpenAssignment} />
        ))}
      </ul>

      {data && data.meta.totalPages > 1 && (
        <Pagination
          page={data.meta.page}
          totalPages={data.meta.totalPages}
          total={data.meta.total}
          limit={data.meta.limit}
          onPageChange={setPage}
          disabled={isPlaceholderData}
        />
      )}
    </>
  );
}

function FineRow({
  group,
  fine,
  onOpenAssignment,
}: {
  group: Group;
  fine: ChoreFine;
  onOpenAssignment: (ref: AssignmentRef) => void;
}) {
  const voidFine = useVoidFine(group.id);
  const [voiding, setVoiding] = useState(false);
  const active = fine.status === "ACTIVE";
  const canVoid = active && isOwner(group.role) && !group.isArchived;

  return (
    <li className="space-y-2 rounded-2xl px-3 py-2.5 hover:bg-background/60">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onOpenAssignment({ choreId: fine.choreId, assignmentId: fine.assignmentId })}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-background">
            <HandCoins className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">
              {fine.payer.name} · {fine.choreName}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {fine.reasons.map((r) => (r === "OVERDUE" ? "late" : "rejected")).join(" + ")} ·{" "}
              {formatDateTime(fine.createdAt, group.timezone)} · {fine.shares.length} recipient
              {fine.shares.length === 1 ? "" : "s"}
              {fine.voidReason && ` · voided: ${fine.voidReason}`}
            </p>
          </div>
        </button>
        {!active && <Pill>Voided</Pill>}
        <span className={cn("shrink-0 font-mono text-sm font-semibold", !active && "line-through opacity-60")}>
          {fine.totalAmount}
        </span>
        {canVoid && !voiding && (
          <Button size="sm" variant="ghost" onClick={() => setVoiding(true)}>
            Void
          </Button>
        )}
      </div>
      {voiding && (
        <ReasonForm
          destructive
          placeholder="Disputed, agreed to drop it…"
          submitLabel="Void fine"
          isPending={voidFine.isPending}
          onSubmit={(reason) =>
            voidFine.mutate({ fineId: fine.id, reason: reason ?? "" }, { onSuccess: () => setVoiding(false) })
          }
          onCancel={() => setVoiding(false)}
        />
      )}
    </li>
  );
}
