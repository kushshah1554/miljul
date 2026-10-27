import { Prisma } from "../generated/prisma/client";
import { prisma } from "./prisma";
import { AppError } from "./AppError";

const SERIALIZATION_RETRY_ATTEMPTS = 3;
const TRANSACTION_TIMEOUT_MS = 5_000;

function isSerializationFailure(error: unknown): boolean {
  // Standard Prisma shape: P2034 = write conflict or deadlock.
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === "P2034";
  }

  // Driver-adapter shape used by this project (@prisma/adapter-pg):
  // a DriverAdapterError whose cause is a TransactionWriteConflict.
  // The adapter maps both SQLSTATE 40001 (serialization failure) and
  // 40P01 (deadlock) to kind "TransactionWriteConflict".
  if (!(error instanceof Error) || error.name !== "DriverAdapterError") {
    return false;
  }

  const cause: unknown = error.cause;
  if (typeof cause !== "object" || cause === null) {
    return false;
  }

  const { kind, originalCode } = cause as {
    kind?: unknown;
    originalCode?: unknown;
  };

  return (
    kind === "TransactionWriteConflict" ||
    originalCode === "40001" ||
    originalCode === "40P01"
  );
}

/**
 * Runs `work` inside a SERIALIZABLE transaction, retrying when PostgreSQL
 * aborts it with a serialization/write conflict (Prisma code P2034).
 *
 * SERIALIZABLE is what makes the last-owner invariant race-safe: two
 * concurrent transactions that each observe "two owners" and demote or
 * remove one would, under READ COMMITTED, leave the group with zero
 * owners. PostgreSQL's SSI detects that write-skew cycle and aborts one
 * transaction; this helper retries it, and the retry then observes a
 * single owner and fails with 409 instead of corrupting the group.
 */
export async function runSerializable<T>(
  work: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  for (let attempt = 1; attempt <= SERIALIZATION_RETRY_ATTEMPTS; attempt += 1) {
    try {
      return await prisma.$transaction(work, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: TRANSACTION_TIMEOUT_MS,
        timeout: TRANSACTION_TIMEOUT_MS,
      });
    } catch (error) {
      if (!isSerializationFailure(error)) {
        throw error;
      }
    }
  }

  throw new AppError(
    409,
    "The group was modified by another request at the same time, please retry",
  );
}
