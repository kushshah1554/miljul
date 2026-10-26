import { apiDelete, apiGet, apiGetWithMeta, apiPatch, apiPost } from "@/lib/api";
import type { ExpenseDetail, ExpenseListItem, PaginationMeta } from "@/lib/types";

// ─── Response shapes (matches API_DOCS.md) ───────────────────────────────────
interface ExpensePayload {
  expense: ExpenseDetail;
}

interface ExpensesPayload {
  expenses: ExpenseListItem[];
}

// ─── Request body / query types ───────────────────────────────────────────────
export interface ExpenseSplitInput {
  userId: string;
  amount: string; // decimal string, e.g. "100.00"
}

export interface CreateExpenseBody {
  description: string;
  amount: string;
  paidById: string;
  splits: ExpenseSplitInput[]; // sum must equal amount
}

export interface UpdateExpenseBody {
  description?: string;
  amount?: string; // changing it requires new splits
  paidById?: string;
  splits?: ExpenseSplitInput[]; // fully replaces old splits
}

export interface ListExpensesQuery {
  page?: number;
  limit?: number;
  from?: string; // ISO date, inclusive
  to?: string; // ISO date, inclusive
}

const expensesUrl = (groupId: string) => `/api/groups/${groupId}/expenses`;

// ─── API functions ────────────────────────────────────────────────────────────

/** POST /api/groups/:groupId/expenses — any member */
export function createExpense(groupId: string, body: CreateExpenseBody) {
  return apiPost<ExpensePayload, CreateExpenseBody>(expensesUrl(groupId), body);
}

/** GET /api/groups/:groupId/expenses — paginated */
export function listExpenses(groupId: string, query: ListExpensesQuery = {}) {
  return apiGetWithMeta<ExpensesPayload, PaginationMeta>(expensesUrl(groupId), {
    params: query,
  });
}

/** GET /api/groups/:groupId/expenses/mine — caller is payer or split participant */
export function listMyExpenses(groupId: string, query: ListExpensesQuery = {}) {
  return apiGetWithMeta<ExpensesPayload, PaginationMeta>(`${expensesUrl(groupId)}/mine`, {
    params: query,
  });
}

/** GET /api/groups/:groupId/expenses/:expenseId */
export function getExpense(groupId: string, expenseId: string) {
  return apiGet<ExpensePayload>(`${expensesUrl(groupId)}/${expenseId}`);
}

/** PATCH /api/groups/:groupId/expenses/:expenseId — OWNER */
export function updateExpense(groupId: string, expenseId: string, body: UpdateExpenseBody) {
  return apiPatch<ExpensePayload, UpdateExpenseBody>(
    `${expensesUrl(groupId)}/${expenseId}`,
    body,
  );
}

/** DELETE /api/groups/:groupId/expenses/:expenseId — OWNER, 204 */
export function deleteExpense(groupId: string, expenseId: string) {
  return apiDelete(`${expensesUrl(groupId)}/${expenseId}`);
}
