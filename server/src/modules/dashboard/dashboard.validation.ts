import { z } from "zod";
import { isValidTimezone } from "../../utils/timezone";

export const dashboardQuerySchema = z.object({
  // Defaults to the current year in `timezone`
  year: z.coerce.number().int().min(2000).max(9998).optional(),
  timezone: z.string().refine(isValidTimezone, "Invalid timezone"),
});

export type DashboardQuery = z.infer<typeof dashboardQuerySchema>;
