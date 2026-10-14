import { z } from "zod";
import { AppError } from "../../utils/AppError";

export const signupSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters"),
  email: z.email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const loginSchema = z.object({
  email: z.email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

export function parseBody<T extends z.ZodType>(
  schema: T,
  body: unknown,
): z.infer<T> {
  const result = schema.safeParse(body);

  if (!result.success) {
    const issue = result.error.issues[0];
    const label = issue?.path.length ? issue.path.join(".") : "body";
    throw new AppError(
      400,
      issue ? `${label}: ${issue.message}` : "Invalid request body",
    );
  }

  return result.data;
}
