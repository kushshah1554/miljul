import { useState } from "react";
import { Plus, Receipt, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pagination } from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { ExpenseDetailSheet } from "@/components/expense/ExpenseDetailSheet";
import { ExpenseFormSheet } from "@/components/expense/ExpenseFormSheet";

import type { ListExpensesQuery } from "@/features/expense/expense.api";
import { useExpenses, useMyExpenses } from "@/features/expense/useExpenses";
import { isOwner } from "@/lib/roles";
import type { ExpenseDetail } from "@/lib/types";
import { useCurrentGroup } from "@/pages/groups/GroupLayout";

type Scope = "all" | "mine";

const PAGE_SIZE = 8;

/** Picked dates are local days; send their local start/end so the whole `to` day is included. */
function dateRange(from: string, to: string): ListExpensesQuery {
  return {
    from: from ? new Date(`${from}T00:00:00`).toISOString() : undefined,
    to: to ? new Date(`${to}T23:59:59.999`).toISOString() : undefined,
  };
}

export default function GroupExpensesPage() {
  const group = useCurrentGroup();
  const [scope, setScope] = useState<Scope>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [viewingId, setViewingId] = useState<string | null>(null);
  // undefined = closed, null = adding, expense = editing
  const [editing, setEditing] = useState<ExpenseDetail | null | undefined>(undefined);

  return (
    <section className="surface space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Expenses</h2>
        {!group.isArchived && (
          <Button size="sm" onClick={() => setEditing(null)}>
            <Plus /> Add expense
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-2">
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

        <div className="ml-auto flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label htmlFor="expense-from" className="text-xs">From</Label>
            <Input
              id="expense-from"
              type="date"
              className="w-36"
              value={from}
              max={to || undefined}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="expense-to" className="text-xs">To</Label>
            <Input
              id="expense-to"
              type="date"
              className="w-36"
              value={to}
              min={from || undefined}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
          {(from || to) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setFrom("");
                setTo("");
              }}
            >
              <X /> Clear
            </Button>
          )}
        </div>
      </div>

      {/* key: a new scope or date range remounts the list, resetting it to page 1 */}
      <ExpenseList
        key={`${scope}|${from}|${to}`}
        groupId={group.id}
        scope={scope}
        range={dateRange(from, to)}
        filtered={!!(from || to)}
        onSelect={setViewingId}
      />

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
  range,
  filtered,
  onSelect,
}: {
  groupId: string;
  scope: Scope;
  range: ListExpensesQuery;
  filtered: boolean;
  onSelect: (expenseId: string) => void;
}) {
  const [page, setPage] = useState(1);
  // Safe: `scope` never changes for a mounted list (keyed by scope above)
  const useList = scope === "mine" ? useMyExpenses : useExpenses;
  const { data, isPending, isError, error, isPlaceholderData } = useList(groupId, {
    ...range,
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
      {data?.expenses.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {filtered
            ? "No expenses in this date range."
            : scope === "mine"
              ? "No expenses involve you yet."
              : "No expenses yet."}
        </p>
      )}

      <ul className="space-y-1">
        {data?.expenses.map((expense) => (
          <li key={expense.id}>
            <button
              type="button"
              onClick={() => onSelect(expense.id)}
              className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors hover:bg-background/70"
            >
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-background">
                <Receipt className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{expense.description}</p>
                <p className="truncate text-xs text-muted-foreground">
                  Paid by {expense.paidBy.name} ·{" "}
                  {new Date(expense.createdAt).toLocaleDateString()} · split{" "}
                  {expense.splits.length} way{expense.splits.length === 1 ? "" : "s"}
                </p>
              </div>
              <span className="shrink-0 font-mono text-sm font-semibold">{expense.amount}</span>
            </button>
          </li>
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
