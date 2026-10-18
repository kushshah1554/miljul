import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth";
import * as expenseController from "./expense.controller";

export const expenseRouter = Router();

// All routes are mounted at /api/groups, so the full paths are:
//   POST   /api/groups/:groupId/expenses
//   GET    /api/groups/:groupId/expenses
//   GET    /api/groups/:groupId/expenses/mine   ← registered BEFORE /:expenseId
//   GET    /api/groups/:groupId/expenses/:expenseId
//   PATCH  /api/groups/:groupId/expenses/:expenseId
//   DELETE /api/groups/:groupId/expenses/:expenseId
//
// The /mine route is registered before /:expenseId so Express cannot
// misinterpret the literal "mine" as a dynamic expense id.

expenseRouter.post(
  "/:groupId/expenses",
  requireAuth,
  expenseController.create,
);

expenseRouter.get(
  "/:groupId/expenses",
  requireAuth,
  expenseController.list,
);

// Static path registered before the dynamic /:expenseId path.
expenseRouter.get(
  "/:groupId/expenses/mine",
  requireAuth,
  expenseController.mine,
);

expenseRouter.get(
  "/:groupId/expenses/:expenseId",
  requireAuth,
  expenseController.getOne,
);

expenseRouter.patch(
  "/:groupId/expenses/:expenseId",
  requireAuth,
  expenseController.update,
);

expenseRouter.delete(
  "/:groupId/expenses/:expenseId",
  requireAuth,
  expenseController.remove,
);
