import { z } from "zod";

// Base notification schemas
export const EmailNotificationSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1),
  text: z.string().optional(),
  html: z.string().optional(),
  provider: z.string().optional(), // Override provider
});

export const SmsNotificationSchema = z.object({
  to: z.string().regex(/^\+[1-9]\d{1,14}$/, {
    message: "Phone number must be in E.164 format (e.g., +905551112233)",
  }),
  text: z.string().min(1),
  provider: z.string().optional(), // Override provider
});

export const PushNotificationSchema = z.object({
  to: z.string().min(1), // FCM token or user ID
  title: z.string().min(1),
  body: z.string().min(1),
  data: z.record(z.string(), z.unknown()).optional(), // Additional payload
  provider: z.string().optional(), // Override provider
});

export const SlackNotificationSchema = z.object({
  to: z.string().min(1), // Channel or user
  text: z.string().min(1),
  provider: z.string().optional(), // Override provider
});

// Main send notification schema
export const SendSchema = z.object({
  email: EmailNotificationSchema.optional(),
  sms: SmsNotificationSchema.optional(),
  push: PushNotificationSchema.optional(),
  slack: SlackNotificationSchema.optional(),
});

// SMTP verification schema
export const SmtpVerifySchema = z.object({
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535),
  secure: z.boolean().optional().default(false),
  user: z.string().min(1),
  pass: z.string().min(1),
});

// SMTP test schema
export const SmtpTestSchema = z.object({
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535),
  secure: z.boolean().optional().default(false),
  user: z.string().min(1),
  pass: z.string().min(1),
  to: z.string().email(),
  subject: z.string().min(1),
  text: z.string().min(1),
});

// In-app notification creation schema
export const CreateInAppNotificationSchema = z.object({
  userId: z.string().uuid(),
  title: z.string().min(1),
  message: z.string().min(1),
  type: z.string().optional(),
  link: z.string().url().optional(),
});

// Notification template schemas
export const CreateTemplateSchema = z.object({
  name: z.string().min(1),
  subject: z.string().min(1),
  content: z.string().min(1),
  type: z.enum(['email', 'sms', 'push', 'slack']),
  variables: z.array(z.string()).optional(),
});

export const UpdateTemplateSchema = z.object({
  name: z.string().min(1).optional(),
  subject: z.string().min(1).optional(),
  content: z.string().min(1).optional(),
  type: z.enum(['email', 'sms', 'push', 'slack']).optional(),
  variables: z.array(z.string()).optional(),
});

export const SendNotificationSchema = z.object({
  templateId: z.string().uuid(),
  recipients: z.array(z.string()).min(1),
  variables: z.record(z.string(), z.unknown()).optional(),
});

export const SendBulkNotificationSchema = z.object({
  templateId: z.string().uuid(),
  recipients: z.array(z.object({
    id: z.string(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    variables: z.record(z.string(), z.unknown()).optional(),
  })).min(1),
});

export const MarkAsReadSchema = z.object({
  notificationIds: z.array(z.string().uuid()),
});

// Types
export type EmailNotification = z.infer<typeof EmailNotificationSchema>;
export type SmsNotification = z.infer<typeof SmsNotificationSchema>;
export type PushNotification = z.infer<typeof PushNotificationSchema>;
export type SlackNotification = z.infer<typeof SlackNotificationSchema>;
export type SendRequest = z.infer<typeof SendSchema>;
export type SmtpVerifyRequest = z.infer<typeof SmtpVerifySchema>;
export type SmtpTestRequest = z.infer<typeof SmtpTestSchema>;
export type CreateInAppNotificationRequest = z.infer<typeof CreateInAppNotificationSchema>;
export type CreateTemplateRequest = z.infer<typeof CreateTemplateSchema>;
export type UpdateTemplateRequest = z.infer<typeof UpdateTemplateSchema>;
export type SendNotificationRequest = z.infer<typeof SendNotificationSchema>;
export type SendBulkNotificationRequest = z.infer<typeof SendBulkNotificationSchema>;
export type MarkAsReadRequest = z.infer<typeof MarkAsReadSchema>;