import { z } from "zod";
import { cuidPattern, groupIdParamSchema } from "../group/group.validation";
import { paginationQueryShape } from "../../utils/pagination";

// ─── Shared primitives ────────────────────────────────────────────────────────

// Monetary amounts are transmitted as strings so JavaScript floating-point
// arithmetic never touches them.  The pattern allows an optional fractional
// part of at most two digits (matching the Decimal(12,2) column).
const monetaryAmountSchema = z
  .string()
  .trim()
  .regex(
    /^\d{1,10}(\.\d{1,2})?$/,
    "Amount must be a positive number with at most 2 decimal places",
  )
  .refine((v) => parseFloat(v) > 0, {
    message: "Amount must be greater than zero",
  });

// Participant amount inside a split.  We accept strictly positive values
// (no zero-value shares).
const splitAmountSchema = z
  .string()
  .trim()
  .regex(
    /^\d{1,10}(\.\d{1,2})?$/,
    "Split amount must be a positive number with at most 2 decimal places",
  )
  .refine((v) => parseFloat(v) > 0, {
    message: "Split amount must be greater than zero",
  });

const userIdSchema = z
  .string()
  .trim()
  .regex(cuidPattern, "User id must be a valid id");

// ─── Route params ─────────────────────────────────────────────────────────────

export const expenseIdParamSchema = z.object({
  ...groupIdParamSchema.shape,
  expenseId: z.string().trim().regex(cuidPattern, "Expense id must be a valid id"),
});

// ─── Request bodies ───────────────────────────────────────────────────────────

const splitInputSchema = z.strictObject({
  userId: userIdSchema,
  amount: splitAmountSchema,
});

export const createExpenseSchema = z.strictObject({
  description: z
    .string()
    .trim()
    .min(1, "Description is required")
    .max(500, "Description must be at most 500 characters"),
  amount: monetaryAmountSchema,
  paidById: userIdSchema,
  splits: z
    .array(splitInputSchema)
    .min(1, "At least one split is required"),
});

// PATCH uses partial semantics: every top-level field is optional, but the
// object must not be completely empty.
export const updateExpenseSchema = z
  .strictObject({
    description: z
      .string()
      .trim()
      .min(1, "Description is required")
      .max(500, "Description must be at most 500 characters")
      .optional(),
    amount: monetaryAmountSchema.optional(),
    paidById: userIdSchema.optional(),
    splits: z.array(splitInputSchema).min(1, "At least one split is required").optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

// ─── Query params ─────────────────────────────────────────────────────────────

// Loose ISO-8601 date string (YYYY-MM-DD or full ISO string).
const dateStringSchema = z
  .string()
  .trim()
  .refine((v) => !Number.isNaN(Date.parse(v)), {
    message: "Must be a valid date string",
  });

export const listExpensesQuerySchema = z
  .object({
    ...paginationQueryShape,
    from: dateStringSchema.optional(),
    to: dateStringSchema.optional(),
  })
  .refine(
    (data) => {
      if (data.from && data.to) {
        return new Date(data.from) <= new Date(data.to);
      }
      return true;
    },
    { message: "from must not be after to" },
  );

// ─── Inferred types ───────────────────────────────────────────────────────────

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;
export type ListExpensesQuery = z.infer<typeof listExpensesQuerySchema>;
export type ExpenseIdParam = z.infer<typeof expenseIdParamSchema>;
export type SplitInput = z.infer<typeof splitInputSchema>;
