import { z } from "zod";

// Limits mirror server/src/modules/user/user.validation.ts
export const profileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must be at most 100 characters"),
});

export type ProfileFormValues = z.infer<typeof profileSchema>;
