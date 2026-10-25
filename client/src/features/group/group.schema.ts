import { z } from "zod";

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

export const joinGroupSchema = z.object({
  joinCode: z
    .string()
    .trim()
    .toUpperCase()
    .length(8, "Join code must be exactly 8 characters"),
});

export type GroupFormValues = z.infer<typeof groupFormSchema>;
export type JoinGroupFormValues = z.infer<typeof joinGroupSchema>;
