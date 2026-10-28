import { z } from "zod";
import { AMOUNT_RE } from "@/lib/money";

// Mirrors server/src/modules/chore/chore.validation.ts
const name = z
  .string()
  .trim()
  .min(1, "Name is required")
  .max(100, "Name must be at most 100 characters");

const description = z
  .string()
  .trim()
  .max(500, "Description must be at most 500 characters");

const label = z
  .string()
  .trim()
  .min(1, "Label is required")
  .max(200, "Label must be at most 200 characters");

/** Fields shared by create and edit */
const choreSettingsSchema = z.object({
  name,
  description,
  // Kept as strings: these are bound to text/time inputs
  intervalDays: z
    .string()
    .trim()
    .refine((v) => /^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= 365, "Enter 1–365 days"),
  deadlineTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Pick a time"),
  finePerMember: z
    .string()
    .trim()
    .refine((v) => AMOUNT_RE.test(v), "Enter an amount ≥ 0 with at most 2 decimals"),
});

export const createChoreSchema = choreSettingsSchema.extend({
  startDate: z.string(), // "" = today
  // Order of ticking = original queue order
  participantIds: z.array(z.string()).min(1, "Pick at least one participant"),
  checklist: z.array(z.object({ label })).max(30, "At most 30 checklist items"),
});

// Editing only sends the settings; the create-only fields stay empty and unchecked
export const editChoreSchema = createChoreSchema.extend({
  participantIds: z.array(z.string()),
});

export const checklistFormSchema = z.object({
  items: z
    .array(z.object({ id: z.string().optional(), label }))
    .max(30, "At most 30 checklist items"),
});

/** Create and edit forms share one value type */
export type ChoreFormValues = z.infer<typeof createChoreSchema>;
export type ChecklistFormValues = z.infer<typeof checklistFormSchema>;
