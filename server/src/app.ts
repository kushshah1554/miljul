import "dotenv/config";
import express from "express";
import cros from "cors";
import cookieParser from "cookie-parser";
import { notFound } from "./middleware/notFound";
import { errorHandler } from "./middleware/errorHandler";
import { authRouter } from "./modules/auth/auth.routes";
import { groupRouter } from "./modules/group/group.routes";
import { groupMemberRouter } from "./modules/group-member/group-member.routes";
import { expenseRouter } from "./modules/expense/expense.routes";
import { balanceRouter } from "./modules/balance/balance.routes";
import { choreRouter } from "./modules/chore/chore.routes";
import { choreAssignmentRouter } from "./modules/chore-assignment/chore-assignment.routes";
import { choreFineRouter } from "./modules/chore-fine/chore-fine.routes";
import { ok } from "./utils/envelope";
import { env } from "./config/env";

export function mainEntryFunction() {
  const app = express();
    
  app.use(
    cros({
      origin: env.CORS_ORIGINS,
      credentials: true,
    }),
  );

  app.use(express.json());
  app.use(cookieParser());

  app.get("/health", (_req, res) =>
    res.json(ok({ message: "server is healthy" })),
  );

  //Auth
  app.use("/auth", authRouter);

  //Groups
  app.use("/api/groups", groupRouter);

  //Group membership (subresource of groups)
  app.use("/api/groups", groupMemberRouter);

  //Expenses (subresource of groups)
  app.use("/api/groups", expenseRouter);

  //Balances (subresource of groups)
  app.use("/api/groups", balanceRouter);

  //Chores, chore assignments and chore fines (subresources of groups)
  app.use("/api/groups", choreRouter);
  app.use("/api/groups", choreAssignmentRouter);
  app.use("/api/groups", choreFineRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
