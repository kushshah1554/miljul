import { z } from "zod";
import { isValidTimezone } from "../../utils/timezone";

const yearSchema = z.coerce.number().int().min(2000).max(9998).optional();

export const dashboardQuerySchema = z.object({
  // Defaults to the current year in `timezone`
  year: yearSchema,
  timezone: z.string().refine(isValidTimezone, "Invalid timezone"),
});

// Both default to the current year in the group's timezone
export const overviewQuerySchema = z.object({ year: yearSchema });

export const leaderboardQuerySchema = z.object({
  year: yearSchema,
  month: z.coerce.number().int().min(1).max(12).optional(), // omitted = the whole year
});

export type DashboardQuery = z.infer<typeof dashboardQuerySchema>;
export type OverviewQuery = z.infer<typeof overviewQuerySchema>;
export type LeaderboardQuery = z.infer<typeof leaderboardQuerySchema>;
