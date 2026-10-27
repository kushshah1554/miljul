import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ok } from "../../utils/envelope";
import { pageMeta } from "../../utils/pagination";
import { requireFound } from "../../utils/helpers";
import { parseBody } from "../auth/auth.validation";
import { groupIdParamSchema } from "../group/group.validation";
import {
  createExpenseSchema,
  updateExpenseSchema,
  expenseIdParamSchema,
  listExpensesQuerySchema,
} from "./expense.validation";
import * as expenseService from "./expense.service";

export const create = asyncHandler(async (req: Request, res: Response) => {
  const authUser = requireFound(req.user, "Authentication required", 401);
  const { groupId } = parseBody(groupIdParamSchema, req.params);
  const input = parseBody(createExpenseSchema, req.body);

  const expense = await expenseService.createExpense(authUser.id, groupId, input);

  res.status(201).json(ok({ expense }));
});

export const list = asyncHandler(async (req: Request, res: Response) => {
  const authUser = requireFound(req.user, "Authentication required", 401);
  const { groupId } = parseBody(groupIdParamSchema, req.params);
  const query = parseBody(listExpensesQuerySchema, req.query);

  const result = await expenseService.listExpenses(authUser.id, groupId, query);

  res.json(
    ok(
      { expenses: result.expenses },
      pageMeta(result.total, result.page, result.limit),
    ),
  );
});

// GET /api/groups/:groupId/expenses/mine
// Must be registered BEFORE /:expenseId to prevent "mine" being parsed as an id.
export const mine = asyncHandler(async (req: Request, res: Response) => {
  const authUser = requireFound(req.user, "Authentication required", 401);
  const { groupId } = parseBody(groupIdParamSchema, req.params);
  const query = parseBody(listExpensesQuerySchema, req.query);

  const result = await expenseService.getMyExpenses(authUser.id, groupId, query);

  res.json(
    ok(
      { expenses: result.expenses },
      pageMeta(result.total, result.page, result.limit),
    ),
  );
});

export const getOne = asyncHandler(async (req: Request, res: Response) => {
  const authUser = requireFound(req.user, "Authentication required", 401);
  const { groupId, expenseId } = parseBody(expenseIdParamSchema, req.params);

  const expense = await expenseService.getExpenseById(
    authUser.id,
    groupId,
    expenseId,
  );

  res.json(ok({ expense }));
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const authUser = requireFound(req.user, "Authentication required", 401);
  const { groupId, expenseId } = parseBody(expenseIdParamSchema, req.params);
  const input = parseBody(updateExpenseSchema, req.body);

  const expense = await expenseService.updateExpense(
    authUser.id,
    groupId,
    expenseId,
    input,
  );

  res.json(ok({ expense }));
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const authUser = requireFound(req.user, "Authentication required", 401);
  const { groupId, expenseId } = parseBody(expenseIdParamSchema, req.params);

  await expenseService.deleteExpense(authUser.id, groupId, expenseId);

  res.status(204).send();
});
