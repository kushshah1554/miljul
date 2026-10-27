import { z } from "zod";
import {
  ChoreAssignmentStatus,
  ChoreReviewDecision,
  ChoreSkipMode,
} from "../../generated/prisma/client";
import { paginationQueryShape } from "../../utils/pagination";
import {
  choreIdParamSchema,
  dateTimeSchema,
  idSchema,
  reasonSchema,
} from "../chore/chore.validation";

export const assignmentIdParamSchema = z.object({
  ...choreIdParamSchema.shape,
  assignmentId: idSchema("Assignment id"),
});

const dateStringSchema = z
  .string()
  .trim()
  .refine((v) => !Number.isNaN(Date.parse(v)), { message: "Must be a valid date string" });

export const listAssignmentsQuerySchema = z.strictObject({
  ...paginationQueryShape,
  userId: idSchema("User id").optional(),
  status: z.enum(ChoreAssignmentStatus).optional(),
  overdue: z.literal("true").optional(),
  from: dateStringSchema.optional(),
  to: dateStringSchema.optional(),
});

export const myAssignmentsQuerySchema = z.strictObject({
  ...paginationQueryShape,
  open: z.literal("true").optional(),
});

export const submitSchema = z.strictObject({
  note: z.string().trim().max(500, "Note must be at most 500 characters").optional(),
});

export const reviewSchema = z
  .strictObject({
    decision: z.enum(ChoreReviewDecision),
    results: z.array(z.strictObject({ itemId: idSchema("Item id"), passed: z.boolean() })),
    feedback: z.string().trim().max(1000, "Feedback must be at most 1000 characters").optional(),
  })
  .refine((d) => d.decision !== ChoreReviewDecision.REJECTED || !!d.feedback, {
    message: "Feedback is required when rejecting",
    path: ["feedback"],
  });

export const skipRequestSchema = z.strictObject({ reason: reasonSchema });

export const skipSchema = z.strictObject({
  reason: reasonSchema,
  mode: z.enum(ChoreSkipMode).default(ChoreSkipMode.DEFER),
  unavailableUntil: dateTimeSchema.optional(),
});

export const waiveSchema = z.strictObject({
  reason: reasonSchema,
  coveredByAssignmentId: idSchema("Assignment id").optional(),
});

export type ListAssignmentsQuery = z.infer<typeof listAssignmentsQuerySchema>;
export type MyAssignmentsQuery = z.infer<typeof myAssignmentsQuerySchema>;
export type SubmitInput = z.infer<typeof submitSchema>;
export type ReviewInput = z.infer<typeof reviewSchema>;
export type SkipRequestInput = z.infer<typeof skipRequestSchema>;
export type SkipInput = z.infer<typeof skipSchema>;
export type WaiveInput = z.infer<typeof waiveSchema>;
