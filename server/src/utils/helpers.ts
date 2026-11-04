import { AppError } from "./AppError";

export function requireFound<T>(
  value: T | null | undefined,
  message: string,
  statusCode = 404,
): T {
  if (!value) {
    throw new AppError(statusCode, message);
  }

  return value;
}
