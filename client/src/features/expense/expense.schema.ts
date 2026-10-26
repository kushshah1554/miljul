import { z } from "zod";
import { toCents, fromCents } from "@/lib/money";

// Mirrors server/src/modules/expense/expense.validation.ts
const AMOUNT_RE = /^\d{1,10}(\.\d{1,2})?$/;
const isPositiveAmount = (v: string) => AMOUNT_RE.test(v.trim()) && Number(v) > 0;

export const expenseFormSchema = z
  .object({
    description: z
      .string()
      .trim()
      .min(1, "Description is required")
      .max(500, "Description must be at most 500 characters"),
    amount: z
      .string()
      .trim()
      .refine(isPositiveAmount, "Enter a positive amount with at most 2 decimals"),
    paidById: z.string().min(1, "Choose who paid"),
    splitMode: z.enum(["equal", "custom"]),
    // One row per current member; `included` marks who shares the expense
    splits: z.array(z.object({ userId: z.string(), included: z.boolean(), amount: z.string() })),
  })
  .superRefine((v, ctx) => {
    const included = v.splits.filter((s) => s.included);
    if (included.length === 0) {
      ctx.addIssue({ code: "custom", path: ["splits"], message: "Pick at least one person" });
      return;
    }
    if (!isPositiveAmount(v.amount)) return; // amount error already shown

    const total = toCents(v.amount);
    if (v.splitMode === "equal") {
      if (total < included.length) {
        ctx.addIssue({ code: "custom", path: ["splits"], message: "Amount is too small to split" });
      }
      return;
    }

    let sum = 0;
    v.splits.forEach((s, i) => {
      if (!s.included) return;
      if (!isPositiveAmount(s.amount)) {
        ctx.addIssue({ code: "custom", path: ["splits", i, "amount"], message: "Invalid amount" });
      } else {
        sum += toCents(s.amount);
      }
    });
    if (sum !== total) {
      ctx.addIssue({
        code: "custom",
        path: ["splits"],
        message: `Splits add up to ${fromCents(sum)}, expected ${fromCents(total)}`,
      });
    }
  });

export type ExpenseFormValues = z.infer<typeof expenseFormSchema>;
