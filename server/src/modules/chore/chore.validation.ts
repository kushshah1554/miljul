import { z } from "zod";
import { ChoreStatus } from "../../generated/prisma/client";
import { cuidPattern, groupIdParamSchema } from "../group/group.validation";
import { paginationQueryShape } from "../../utils/pagination";

// ─── Shared primitives (also used by chore-assignment / chore-fine) ───────────

export const idSchema = (label: string) =>
  z.string().trim().regex(cuidPattern, `${label} must be a valid id`);

const isUnique = (ids: string[]) => new Set(ids).size === ids.length;

export const reasonSchema = z
  .string()
  .trim()
  .min(1, "Reason is required")
  .max(200, "Reason must be at most 200 characters");

const optionalReasonSchema = z
  .string()
  .trim()
  .max(200, "Reason must be at most 200 characters")
  .optional();

// Bodies whose only field is an optional reason (archive, pause, resume).
export const optionalReasonBodySchema = z.strictObject({ reason: optionalReasonSchema });

export const dateTimeSchema = z.iso
  .datetime({ offset: true, message: "Must be an ISO datetime" })
  .transform((v) => new Date(v));

const nameSchema = z
  .string()
  .trim()
  .min(1, "Name is required")
  .max(100, "Name must be at most 100 characters");

const descriptionSchema = z
  .string()
  .trim()
  .max(500, "Description must be at most 500 characters");

const intervalDaysSchema = z
  .number()
  .int("intervalDays must be a whole number")
  .min(1, "intervalDays must be at least 1")
  .max(365, "intervalDays must be at most 365");

// "HH:MM" → minutes after local midnight.
const deadlineTimeSchema = z
  .string()
  .trim()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "deadlineTime must be HH:MM")
  .transform((v) => {
    const [h, m] = v.split(":").map(Number);
    return h * 60 + m;
  });

const fineAmountSchema = z
  .string()
  .trim()
  .regex(
    /^\d{1,10}(\.\d{1,2})?$/,
    "finePerMember must be a number ≥ 0 with at most 2 decimal places",
  );

const labelSchema = z
  .string()
  .trim()
  .min(1, "Label is required")
  .max(200, "Label must be at most 200 characters");

const indexSchema = z.number().int().min(0, "Position must be at least 0");

// ─── Route params ─────────────────────────────────────────────────────────────

export const choreIdParamSchema = z.object({
  ...groupIdParamSchema.shape,
  choreId: idSchema("Chore id"),
});

export const participantParamSchema = z.object({
  ...choreIdParamSchema.shape,
  userId: idSchema("User id"),
});

// ─── Chores ───────────────────────────────────────────────────────────────────

export const createChoreSchema = z.strictObject({
  name: nameSchema,
  description: descriptionSchema.optional(),
  intervalDays: intervalDaysSchema,
  deadlineTime: deadlineTimeSchema.optional(),
  finePerMember: fineAmountSchema.optional(),
  startDate: z.iso.date("startDate must be YYYY-MM-DD").optional(),
  participantIds: z
    .array(idSchema("User id"))
    .min(1, "At least one participant is required")
    .refine(isUnique, "Duplicate participant"),
  checklist: z.array(labelSchema).max(30, "At most 30 checklist items").optional(),
});

export const updateChoreSchema = z
  .strictObject({
    name: nameSchema.optional(),
    description: descriptionSchema.nullable().optional(),
    intervalDays: intervalDaysSchema.optional(),
    deadlineTime: deadlineTimeSchema.optional(),
    finePerMember: fineAmountSchema.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

export const listChoresQuerySchema = z.strictObject({
  status: z.enum(ChoreStatus).optional(),
});

export const getChoreQuerySchema = z.strictObject({
  upcoming: z
    .string()
    .optional()
    .transform((v) => (v === undefined ? 10 : parseInt(v, 10)))
    .pipe(z.number().int().min(0).max(50, "upcoming must be at most 50")),
});

// ─── Participants ─────────────────────────────────────────────────────────────

export const addParticipantSchema = z.strictObject({
  userId: idSchema("User id"),
  position: indexSchema.optional(),
  cyclePosition: indexSchema.optional(),
});

export const removeParticipantQuerySchema = z.strictObject({
  currentTurn: z.enum(["reassign", "keep"]).optional(),
});

export const setAvailabilitySchema = z.strictObject({
  unavailableUntil: dateTimeSchema.nullable(),
  reason: optionalReasonSchema,
});

// ─── Queues ───────────────────────────────────────────────────────────────────

export const reorderQueueSchema = z.strictObject({
  order: z.array(idSchema("User id")).refine(isUnique, "Duplicate user in order"),
});

export const swapSchema = z
  .strictObject({ userIdA: idSchema("User id"), userIdB: idSchema("User id") })
  .refine((d) => d.userIdA !== d.userIdB, { message: "Cannot swap a member with themselves" });

export const moveSchema = z.strictObject({
  userId: idSchema("User id"),
  toIndex: indexSchema,
});

// ─── Checklist ────────────────────────────────────────────────────────────────

export const replaceChecklistSchema = z.strictObject({
  items: z
    .array(z.strictObject({ id: idSchema("Item id").optional(), label: labelSchema }))
    .max(30, "At most 30 checklist items"),
});

// ─── Pauses ───────────────────────────────────────────────────────────────────

export const listPausesQuerySchema = z.strictObject({
  ...paginationQueryShape,
  choreId: idSchema("Chore id").optional(),
  groupWide: z.literal("true").optional(),
});

// ─── Inferred types ───────────────────────────────────────────────────────────

export type CreateChoreInput = z.infer<typeof createChoreSchema>;
export type UpdateChoreInput = z.infer<typeof updateChoreSchema>;
export type ListChoresQuery = z.infer<typeof listChoresQuerySchema>;
export type AddParticipantInput = z.infer<typeof addParticipantSchema>;
export type RemoveParticipantQuery = z.infer<typeof removeParticipantQuerySchema>;
export type SetAvailabilityInput = z.infer<typeof setAvailabilitySchema>;
export type ReorderQueueInput = z.infer<typeof reorderQueueSchema>;
export type SwapInput = z.infer<typeof swapSchema>;
export type MoveInput = z.infer<typeof moveSchema>;
export type ReplaceChecklistInput = z.infer<typeof replaceChecklistSchema>;
export type OptionalReasonInput = z.infer<typeof optionalReasonBodySchema>;
export type ListPausesQuery = z.infer<typeof listPausesQuerySchema>;
