import { z } from "zod";

export const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(2, { message: "İsim en az 2 karakter olmalıdır" }),
  // E.164 format: +[country code][national number], max 15 digits
  phone: z
    .string()
    .regex(/^\+[1-9]\d{1,14}$/i, {
      message:
        "Telefon numarası E.164 formatında olmalıdır (örn. +905551112233)",
    })
    .optional(),
  gender: z.enum(["male", "female", "other"]).optional(),
  // Registration-time role selection
  // By default, users are created as 'customer'.
  // Salon sahipleri için 'salon_owner' rolüne izin veriyoruz.
  role: z.enum(["customer", "barber", "salon_owner"]).optional(),
});

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const VerifyEmailSchema = z.object({
  email: z.string().email(),
  code: z.string().min(4).max(8),
});

export const ResendEmailSchema = z.object({
  email: z.string().email(),
});

export const PhoneStartSchema = z.object({
  phone: z.string().regex(/^\+[1-9]\d{1,14}$/i, {
    message: "Telefon numarası E.164 formatında olmalıdır (örn. +905551112233)",
  }),
  userName: z.string().optional(),
});

export const PhoneVerifySchema = z.object({
  phone: z.string().regex(/^\+[1-9]\d{1,14}$/i, {
    message: "Telefon numarası E.164 formatında olmalıdır (örn. +905551112233)",
  }),
  code: z.string().min(4).max(8),
});

export const LoginByPhoneSchema = z.object({
  phone: z.string().regex(/^\+[1-9]\d{1,14}$/i, {
    message: "Telefon numarası E.164 formatında olmalıdır (örn. +905551112233)",
  }),
});

// Password reset by email
export const EmailPasswordResetStartSchema = z.object({
  email: z.string().email(),
});

export const VerifyEmailPasswordResetSchema = z.object({
  email: z.string().email(),
  code: z.string().min(4).max(8),
});

export const ResetPasswordByEmailSchema = z.object({
  email: z.string().email(),
  code: z.string().min(4).max(8),
  newPassword: z.string().min(6),
});

// Password reset by phone
export const PhonePasswordResetStartSchema = z.object({
  phone: z.string().regex(/^\+[1-9]\d{1,14}$/i, {
    message: "Telefon numarası E.164 formatında olmalıdır (örn. +905551112233)",
  }),
});

export const VerifyPhonePasswordResetSchema = z.object({
  phone: z.string().regex(/^\+[1-9]\d{1,14}$/i, {
    message: "Telefon numarası E.164 formatında olmalıdır (örn. +905551112233)",
  }),
  code: z.string().min(4).max(8),
});

export const ResetPasswordByPhoneSchema = z.object({
  phone: z.string().regex(/^\+[1-9]\d{1,14}$/i, {
    message: "Telefon numarası E.164 formatında olmalıdır (örn. +905551112233)",
  }),
  code: z.string().min(4).max(8),
  newPassword: z.string().min(6),
});

export type RegisterRequest = z.infer<typeof RegisterSchema>;
export type LoginRequest = z.infer<typeof LoginSchema>;
export type VerifyEmailRequest = z.infer<typeof VerifyEmailSchema>;
export type ResendEmailRequest = z.infer<typeof ResendEmailSchema>;
export type PhoneStartRequest = z.infer<typeof PhoneStartSchema>;
export type PhoneVerifyRequest = z.infer<typeof PhoneVerifySchema>;
export type LoginByPhoneRequest = z.infer<typeof LoginByPhoneSchema>;

export type EmailPasswordResetStartRequest = z.infer<
  typeof EmailPasswordResetStartSchema
>;
export type VerifyEmailPasswordResetRequest = z.infer<
  typeof VerifyEmailPasswordResetSchema
>;
export type ResetPasswordByEmailRequest = z.infer<
  typeof ResetPasswordByEmailSchema
>;

export type PhonePasswordResetStartRequest = z.infer<
  typeof PhonePasswordResetStartSchema
>;
export type VerifyPhonePasswordResetRequest = z.infer<
  typeof VerifyPhonePasswordResetSchema
>;
export type ResetPasswordByPhoneRequest = z.infer<
  typeof ResetPasswordByPhoneSchema
>;

export type JwtPayload = {
  sub: string;
  email: string;
  role: "admin" | "supervisor" | "barber" | "salon_owner" | "customer";
};
