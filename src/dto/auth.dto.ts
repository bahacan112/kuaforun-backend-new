import { z } from "zod";

// ============================================================================
// AUTH DTO SCHEMAS
// ============================================================================

export const RegisterUserSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().min(2, "Name must be at least 2 characters").optional(),
  phone: z
    .string()
    .regex(/^\+[1-9]\d{1,14}$/,
      "Phone must be in E.164 format, e.g. +905061175807"),
  gender: z.enum(["male", "female", "other"] as const).optional()
});

export const LoginUserSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(1, "Password is required")
});

export const VerifyEmailSchema = z.object({
  email: z.string().email("Invalid email format"),
  code: z.string().length(6, "Verification code must be 6 digits")
});

export const ResendVerificationSchema = z.object({
  email: z.string().email("Invalid email format")
});

export const ForgotPasswordSchema = z.object({
  email: z.string().email("Invalid email format")
});

export const ResetPasswordSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  password: z.string().min(8, "Password must be at least 8 characters")
});

export const RefreshTokenSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token is required")
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type RegisterUserDto = z.infer<typeof RegisterUserSchema>;
export type LoginUserDto = z.infer<typeof LoginUserSchema>;
export type VerifyEmailDto = z.infer<typeof VerifyEmailSchema>;
export type ResendVerificationDto = z.infer<typeof ResendVerificationSchema>;
export type ForgotPasswordDto = z.infer<typeof ForgotPasswordSchema>;
export type ResetPasswordDto = z.infer<typeof ResetPasswordSchema>;
export type RefreshTokenDto = z.infer<typeof RefreshTokenSchema>;