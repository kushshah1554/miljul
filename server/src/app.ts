import "dotenv/config";
import express from "express";
import cros from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { notFound } from "./middleware/notFound";
import { globalLimiter } from "./middleware/rateLimit";
import { errorHandler } from "./middleware/errorHandler";
import { authRouter } from "./modules/auth/auth.routes";
import { userRouter } from "./modules/user/user.routes";
import { groupRouter } from "./modules/group/group.routes";
import { groupMemberRouter } from "./modules/group-member/group-member.routes";
import { expenseRouter } from "./modules/expense/expense.routes";
import { balanceRouter } from "./modules/balance/balance.routes";
import { choreRouter } from "./modules/chore/chore.routes";
import { choreAssignmentRouter } from "./modules/chore-assignment/chore-assignment.routes";
import { choreFineRouter } from "./modules/chore-fine/chore-fine.routes";
import { anonymousMessageRouter } from "./modules/anonymous-message/anonymous-message.routes";
import { dashboardRouter, groupDashboardRouter } from "./modules/dashboard/dashboard.routes";
import { ok } from "./utils/envelope";
import { env } from "./config/env";

export function mainEntryFunction() {
  const app = express();
    
  // How many proxies sit in front of the app, so req.ip is the caller's address
  app.set("trust proxy", env.TRUST_PROXY_HOPS);

  app.use(helmet());

  app.use(
    cros({
      origin: env.CORS_ORIGINS,
      credentials: true,
    }),
  );

  // Before the limiter: Render's health checks must never be refused
  app.get("/health", (_req, res) =>
    res.json(ok({ message: "server is healthy" })),
  );

  // Before body parsing, so refused requests cost nothing
  app.use(globalLimiter);

  // Responses hold tokens and private data: never let a browser or proxy store them
  app.use((_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });

  app.use(express.json({ limit: "100kb" }));
  app.use(cookieParser());

  //Auth
  app.use("/auth", authRouter);

  //Users
  app.use("/api/users", userRouter);

  //Dashboard
  app.use("/api/dashboard", dashboardRouter);

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

  //Group overview and leaderboard (subresources of groups)
  app.use("/api/groups", groupDashboardRouter);

  //Anonymous messages (subresource of groups)
  app.use("/api/groups", anonymousMessageRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
