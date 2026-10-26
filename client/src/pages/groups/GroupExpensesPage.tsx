import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useExpenses } from "@/features/expense/useExpenses";
import { useCurrentGroup } from "@/pages/groups/GroupLayout";

export default function GroupExpensesPage() {
  const group = useCurrentGroup();
  const [page, setPage] = useState(1);
  const { data, isPending, isError, error, isPlaceholderData } = useExpenses(group.id, { page });

  return (
    <section className="rounded-xl border border-border p-4 space-y-3">
      <h2 className="font-semibold">Expenses</h2>

      {isPending && (
        <div className="space-y-2">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      )}
      {isError && <p className="text-sm text-destructive">{error.message}</p>}
      {data?.expenses.length === 0 && (
        <p className="text-sm text-muted-foreground">No expenses yet.</p>
      )}

      <ul className="divide-y divide-border">
        {data?.expenses.map((expense) => (
          <li key={expense.id} className="flex items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{expense.description}</p>
              <p className="truncate text-xs text-muted-foreground">
                Paid by {expense.paidBy.name} ·{" "}
                {new Date(expense.createdAt).toLocaleDateString()} · split{" "}
                {expense.splits.length} way{expense.splits.length === 1 ? "" : "s"}
              </p>
            </div>
            <span className="shrink-0 font-mono text-sm font-medium">{expense.amount}</span>
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
    </section>
  );
}
