import "dotenv/config";
import express from "express";
import cros from "cors";
import { notFound } from "./middleware/notFound";
import { errorHandler } from "./middleware/errorHandler";
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

  app.get("/health", (_req, res) =>
    res.json(ok({ message: "server is healthy" })),
  );

  //Auth
  //   app.use("/auth", authRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
