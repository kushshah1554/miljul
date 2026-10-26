import { useState } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ExpenseDetailSheet } from "@/components/expense/ExpenseDetailSheet";
import { ExpenseFormSheet } from "@/components/expense/ExpenseFormSheet";

import { useExpenses, useMyExpenses } from "@/features/expense/useExpenses";
import { isOwner } from "@/lib/roles";
import type { ExpenseDetail } from "@/lib/types";
import { useCurrentGroup } from "@/pages/groups/GroupLayout";

type Scope = "all" | "mine";

export default function GroupExpensesPage() {
  const group = useCurrentGroup();
  const [scope, setScope] = useState<Scope>("all");
  const [viewingId, setViewingId] = useState<string | null>(null);
  // undefined = closed, null = adding, expense = editing
  const [editing, setEditing] = useState<ExpenseDetail | null | undefined>(undefined);

  return (
    <section className="rounded-xl border border-border p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Expenses</h2>
        {!group.isArchived && (
          <Button size="sm" onClick={() => setEditing(null)}>
            <Plus /> Add expense
          </Button>
        )}
      </div>

      <div className="flex gap-2">
        {(["all", "mine"] as const).map((tab) => (
          <Button
            key={tab}
            size="sm"
            variant={scope === tab ? "default" : "outline"}
            onClick={() => setScope(tab)}
          >
            {tab === "all" ? "All" : "Mine"}
          </Button>
        ))}
      </div>

      {/* key: each scope keeps its own page state and query hook */}
      <ExpenseList key={scope} groupId={group.id} scope={scope} onSelect={setViewingId} />

      <ExpenseDetailSheet
        groupId={group.id}
        expenseId={viewingId}
        canManage={isOwner(group.role) && !group.isArchived}
        onClose={() => setViewingId(null)}
        onEdit={(expense) => {
          setViewingId(null);
          setEditing(expense);
        }}
      />
      <ExpenseFormSheet
        groupId={group.id}
        open={editing !== undefined}
        onOpenChange={(open) => !open && setEditing(undefined)}
        expense={editing ?? undefined}
      />
    </section>
  );
}

function ExpenseList({
  groupId,
  scope,
  onSelect,
}: {
  groupId: string;
  scope: Scope;
  onSelect: (expenseId: string) => void;
}) {
  const [page, setPage] = useState(1);
  // Safe: `scope` never changes for a mounted list (keyed by scope above)
  const useList = scope === "mine" ? useMyExpenses : useExpenses;
  const { data, isPending, isError, error, isPlaceholderData } = useList(groupId, { page });

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
      {data?.expenses.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {scope === "mine" ? "No expenses involve you yet." : "No expenses yet."}
        </p>
      )}

      <ul className="divide-y divide-border">
        {data?.expenses.map((expense) => (
          <li key={expense.id}>
            <button
              type="button"
              onClick={() => onSelect(expense.id)}
              className="flex w-full items-center gap-3 rounded-md px-1 py-3 text-left hover:bg-muted/50"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{expense.description}</p>
                <p className="truncate text-xs text-muted-foreground">
                  Paid by {expense.paidBy.name} ·{" "}
                  {new Date(expense.createdAt).toLocaleDateString()} · split{" "}
                  {expense.splits.length} way{expense.splits.length === 1 ? "" : "s"}
                </p>
              </div>
              <span className="shrink-0 font-mono text-sm font-medium">{expense.amount}</span>
            </button>
          </li>
        ))}
      </ul>

      {data && data.meta.totalPages > 1 && (
        <div className="flex items-center justify-between gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => p - 1)}
            disabled={page <= 1 || isPlaceholderData}
          >
            Previous
          </Button>
          <span className="text-xs text-muted-foreground">
            Page {data.meta.page} of {data.meta.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => p + 1)}
            disabled={page >= data.meta.totalPages || isPlaceholderData}
          >
            Next
          </Button>
        </div>
      )}
    </>
  );
}
