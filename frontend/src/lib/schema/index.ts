import { z } from "zod";

export const passwordSchema = z
  .string()
  .min(8, { message: "Password must be at least 8 characters" })
  .refine((password) => /\d/.test(password), {
    message: "Password must contain at least one number",
  })
  .refine((password) => /[a-z]/.test(password), {
    message: "Password must contain at least one lowercase letter",
  })
  .refine((password) => /[A-Z]/.test(password), {
    message: "Password must contain at least one uppercase letter",
  })
  .refine((password) => /[!@#$%^&*(),.?":{}|<>]/.test(password), {
    message: "Password must contain at least one special character",
  });

const emailSchema = z
  .string()
  .trim()
  .email({ message: "Please provide a valid email address" })
  .toLowerCase();

export const signupSchema = z.object({
  email: emailSchema,
  username: z
    .string()
    .trim()
    .min(3, { message: "Username must be at least 3 characters" })
    .max(255, { message: "Username can't be greater than 255 characters" }),
  password: passwordSchema,
  confirmPassword: passwordSchema,
});

export const signinSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});
