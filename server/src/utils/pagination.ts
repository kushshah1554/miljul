import { z } from "zod";

// Shared `?page=&limit=` query fields: page ≥ 1 (default 1), limit 1–100 (default 20).
export const paginationQueryShape = {
  page: z
    .string()
    .optional()
    .transform((v) => (v === undefined ? 1 : parseInt(v, 10)))
    .pipe(z.number().int().min(1, "Page must be at least 1")),
  limit: z
    .string()
    .optional()
    .transform((v) => (v === undefined ? 20 : parseInt(v, 10)))
    .pipe(
      z
        .number()
        .int()
        .min(1, "Limit must be at least 1")
        .max(100, "Limit must be at most 100"),
    ),
};

/** `meta` block of a paginated envelope. */
export function pageMeta(total: number, page: number, limit: number) {
  return { total, page, limit, totalPages: Math.ceil(total / limit) };
}
