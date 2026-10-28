import { z } from "zod";
import { isValidTimezone } from "@/lib/time";

// Limits mirror server/src/modules/group/group.validation.ts
const name = z
  .string()
  .trim()
  .min(1, "Group name is required")
  .max(100, "Group name must be at most 100 characters");

const description = z
  .string()
  .trim()
  .max(500, "Description must be at most 500 characters");

export const groupFormSchema = z.object({ name, description });

// Settings also edit the timezone chore deadlines are calculated in
export const groupSettingsSchema = groupFormSchema.extend({
  timezone: z.string().trim().refine(isValidTimezone, "Unknown timezone"),
});

export const joinGroupSchema = z.object({
  joinCode: z
    .string()
    .trim()
    .toUpperCase()
    .length(8, "Join code must be exactly 8 characters"),
});

export type GroupFormValues = z.infer<typeof groupFormSchema>;
export type GroupSettingsValues = z.infer<typeof groupSettingsSchema>;
export type JoinGroupFormValues = z.infer<typeof joinGroupSchema>;
