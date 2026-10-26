import { Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

import { useDeleteExpense, useExpense } from "@/features/expense/useExpenses";
import type { ExpenseDetail } from "@/lib/types";

/** Read-only view of one expense; owners of an active group also get Edit / Delete. */
export function ExpenseDetailSheet({
  groupId,
  expenseId,
  canManage,
  onClose,
  onEdit,
}: {
  groupId: string;
  expenseId: string | null;
  canManage: boolean;
  onClose: () => void;
  onEdit: (expense: ExpenseDetail) => void;
}) {
  return (
    <Sheet open={!!expenseId} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="overflow-y-auto">
        {expenseId && (
          <ExpenseDetailBody
            groupId={groupId}
            expenseId={expenseId}
            canManage={canManage}
            onClose={onClose}
            onEdit={onEdit}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function ExpenseDetailBody({
  groupId,
  expenseId,
  canManage,
  onClose,
  onEdit,
}: {
  groupId: string;
  expenseId: string;
  canManage: boolean;
  onClose: () => void;
  onEdit: (expense: ExpenseDetail) => void;
}) {
  const { data: expense, isPending, isError, error } = useExpense(groupId, expenseId);
  const remove = useDeleteExpense(groupId);

  const handleDelete = () => {
    if (expense && window.confirm(`Delete "${expense.description}"? This cannot be undone.`)) {
      remove.mutate(expense.id, { onSuccess: onClose });
    }
  };

  return (
    <>
      <SheetHeader>
        <SheetTitle className="pr-8">{expense?.description ?? "Expense"}</SheetTitle>
        <SheetDescription>
          {expense
            ? `Paid by ${expense.paidBy.name} on ${new Date(expense.createdAt).toLocaleDateString()}`
            : "Loading…"}
        </SheetDescription>
      </SheetHeader>

      <div className="space-y-4 px-4">
        {isPending && <Skeleton className="h-24 w-full" />}
        {isError && <p className="text-sm text-destructive">{error.message}</p>}

        {expense && (
          <>
            <p className="font-mono text-3xl font-bold">{expense.amount}</p>
            <div className="space-y-2">
              <h3 className="text-sm font-medium">
                Split between {expense.splits.length}{" "}
                {expense.splits.length === 1 ? "person" : "people"}
              </h3>
              <ul className="space-y-1 rounded-2xl bg-card p-1.5">
                {expense.splits.map((split) => (
                  <li key={split.id} className="flex items-center justify-between gap-3 rounded-xl bg-background px-3 py-2.5">
                    <span className="truncate text-sm">{split.user.name}</span>
                    <span className="font-mono text-sm">{split.amount}</span>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </div>

      {expense && canManage && (
        <SheetFooter>
          <Button variant="outline" onClick={() => onEdit(expense)}>
            <Pencil /> Edit
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={remove.isPending}>
            <Trash2 /> {remove.isPending ? "Deleting…" : "Delete"}
          </Button>
        </SheetFooter>
      )}
    </>
  );
}
