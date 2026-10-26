import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  createExpense,
  deleteExpense,
  getExpense,
  listExpenses,
  listMyExpenses,
  updateExpense,
} from "@/features/expense/expense.api";
import type {
  CreateExpenseBody,
  ListExpensesQuery,
  UpdateExpenseBody,
} from "@/features/expense/expense.api";
import { balanceKeys } from "@/features/balance/useBalances";
import { groupKeys } from "@/features/group/useGroups";

// ─── Query keys ───────────────────────────────────────────────────────────────
// Nested under the group's detail key, like members
export const expenseKeys = {
  all: (groupId: string) => [...groupKeys.detail(groupId), "expenses"] as const,
  list: (groupId: string, scope: "all" | "mine", query: ListExpensesQuery) =>
    [...expenseKeys.all(groupId), "list", scope, query] as const,
  detail: (groupId: string, expenseId: string) =>
    [...expenseKeys.all(groupId), "detail", expenseId] as const,
};

/** Any expense change moves balances too, so refetch both subtrees. */
function useRefreshExpenses(groupId: string) {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: expenseKeys.all(groupId) });
    queryClient.invalidateQueries({ queryKey: balanceKeys.all(groupId) });
  };
}

// ─── Queries ──────────────────────────────────────────────────────────────────
export function useExpenses(groupId: string, query: ListExpensesQuery = {}) {
  return useQuery({
    queryKey: expenseKeys.list(groupId, "all", query),
    queryFn: () => listExpenses(groupId, query),
    select: ({ data, meta }) => ({ expenses: data.expenses, meta }),
    placeholderData: keepPreviousData, // no flash between pages
  });
}

export function useMyExpenses(groupId: string, query: ListExpensesQuery = {}) {
  return useQuery({
    queryKey: expenseKeys.list(groupId, "mine", query),
    queryFn: () => listMyExpenses(groupId, query),
    select: ({ data, meta }) => ({ expenses: data.expenses, meta }),
    placeholderData: keepPreviousData,
  });
}

export function useExpense(groupId: string, expenseId: string) {
  return useQuery({
    queryKey: expenseKeys.detail(groupId, expenseId),
    queryFn: () => getExpense(groupId, expenseId),
    select: (data) => data.expense,
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────
export function useCreateExpense(groupId: string) {
  const refreshExpenses = useRefreshExpenses(groupId);

  return useMutation({
    mutationFn: (body: CreateExpenseBody) => createExpense(groupId, body),
    onSuccess: () => {
      refreshExpenses();
      toast.success("Expense added");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useUpdateExpense(groupId: string) {
  const refreshExpenses = useRefreshExpenses(groupId);

  return useMutation({
    mutationFn: ({ expenseId, ...body }: { expenseId: string } & UpdateExpenseBody) =>
      updateExpense(groupId, expenseId, body),
    onSuccess: () => {
      refreshExpenses();
      toast.success("Expense updated");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useDeleteExpense(groupId: string) {
  const queryClient = useQueryClient();
  const refreshExpenses = useRefreshExpenses(groupId);

  return useMutation({
    mutationFn: (expenseId: string) => deleteExpense(groupId, expenseId),
    onSuccess: (_data, expenseId) => {
      // Drop the deleted detail so it isn't refetched into a 404
      queryClient.removeQueries({ queryKey: expenseKeys.detail(groupId, expenseId) });
      refreshExpenses();
      toast.success("Expense deleted");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}
