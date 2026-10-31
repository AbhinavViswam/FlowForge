import { z } from 'zod';

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters long')
  .max(200, 'Password must be at most 200 characters long');

export const registerSchema = z.object({
  email: z.string().email(),
  password: passwordSchema,
});

export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().max(200),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().email('Enter a valid email address'),
});

export const resetPasswordSchema = z.object({
  email: z.string().email(),
  code: z.string(),
  password: passwordSchema,
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().max(200),
  newPassword: passwordSchema,
});
