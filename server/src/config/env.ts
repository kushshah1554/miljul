import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(5000),
  //   DATABASE_URL: z.string().url(),
  LOG_LEVEL: z
    .enum(["trace", "debug", "info", "warn", "error", "fatal"])
    .default("info"),
  CORS_ORIGINS: z
    .string()
    .default("http://localhost:5173")
    .transform((v) => v.split(",").map((o) => o.trim())),

  //   JWT_SECRET: z.string().min(1, 'JWT_SECRET is required'),
  //   JWT_REFRESH_SECRET: z.string().min(1, 'JWT_REFRESH_SECRET is required'),
  // postgresql
  DATABASE_URL: z
    .string()
    .url()
    .default(
      "postgresql://myuser:mypassword@localhost:5432/miljul?schema=public",
    ),
  REDIS_URL: z.string().url().default("redis://localhost:6379"),

  SMTP_HOST: z.string().default("localhost"),
  SMTP_PORT: z.coerce.number().int().positive().default(1025),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  EMAIL_FROM: z.string().default("no-reply@telemed.local"),
});

export type Env = z.infer<typeof schema>;

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error(
    "Invalid environment:",
    z.prettifyError?.(parsed.error) ?? parsed.error.issues,
  );
  process.exit(1);
}

export const env: Env = parsed.data;
