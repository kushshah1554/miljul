import { z } from "zod";

const groupNameSchema = z
  .string()
  .trim()
  .min(1, "Group name is required")
  .max(100, "Group name must be at most 100 characters");

const groupDescriptionSchema = z
  .string()
  .trim()
  .max(500, "Group description must be at most 500 characters");

export const createGroupSchema = z.strictObject({
  name: groupNameSchema,
  description: groupDescriptionSchema.nullable().optional(),
});

export const updateGroupSchema = z
  .strictObject({
    name: groupNameSchema.optional(),
    description: groupDescriptionSchema.nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one of name or description is required",
  });

// Prisma ids are cuids: "c" followed by 20+ base36 characters.
const cuidPattern = /^c[0-9a-z]{20,}$/;

export const groupIdParamSchema = z.object({
  groupId: z
    .string()
    .trim()
    .regex(cuidPattern, "Group id must be a valid id"),
});

export type CreateGroupInput = z.infer<typeof createGroupSchema>;
export type UpdateGroupInput = z.infer<typeof updateGroupSchema>;
export type GroupIdParam = z.infer<typeof groupIdParamSchema>;
