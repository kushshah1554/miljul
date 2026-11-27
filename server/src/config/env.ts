import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(5000),
  //   DATABASE_URL: z.string().url(),
  // 0 = no proxy (local). See DEPLOYMENT.md for Render.
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(10).default(0),
  LOG_LEVEL: z
    .enum(["trace", "debug", "info", "warn", "error", "fatal"])
    .default("info"),
  CORS_ORIGINS: z
    .string()
    .default("http://localhost:5173")
    .transform((v) => v.split(",").map((o) => o.trim())),

  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_REFRESH_SECRET: z.string().min(32, "JWT_REFRESH_SECRET must be at least 32 characters"),
  ACCESS_TOKEN_TTL: z.string().default("15m"),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(7),
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

  GOOGLE_CLIENT_ID: z.string().min(1, "GOOGLE_CLIENT_ID is required"),
  GOOGLE_CLIENT_SECRET: z.string().min(1, "GOOGLE_CLIENT_SECRET is required"),
  GOOGLE_CALLBACK_URL: z.string().url(),
  CLIENT_URL: z.string().url().default("http://localhost:5173"),

  CLOUDINARY_CLOUD_NAME: z.string().min(1, "CLOUDINARY_CLOUD_NAME is required"),
  CLOUDINARY_API_KEY: z.string().min(1, "CLOUDINARY_API_KEY is required"),
  CLOUDINARY_API_SECRET: z.string().min(1, "CLOUDINARY_API_SECRET is required"),

  // Signs anonymous-message author hashes. Changing it makes members unable
  // to delete their existing messages (the owner still can).
  ANON_MESSAGE_SECRET: z.string().min(32, "ANON_MESSAGE_SECRET must be at least 32 characters"),
}).refine((e) => e.JWT_SECRET !== e.JWT_REFRESH_SECRET, {
  // With one shared secret a refresh token would also pass as an access token
  message: "JWT_SECRET and JWT_REFRESH_SECRET must be different",
  path: ["JWT_REFRESH_SECRET"],
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
