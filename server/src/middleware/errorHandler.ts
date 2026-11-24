import type { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/AppError";
import { fail } from "../utils/envelope";

export function errorHandler(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json(fail(err.message, "API_ERROR"));
  }

  if (err?.type === "entity.parse.failed") {
    return res.status(400).json(fail("Invalid JSON body", "INVALID_JSON"));
  }

  if (err?.type === "entity.too.large") {
    return res.status(413).json(fail("Request body is too large", "BODY_TOO_LARGE"));
  }

  console.log("error:", err);
  return res.status(500).json(fail("Internal Server Error", "INTERNAL_ERROR"));
}
