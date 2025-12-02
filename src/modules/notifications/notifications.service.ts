import { db } from "../../db";
import { notifications, inAppNotifications } from "../../db/schema";
import { env } from "../../core/env";
import { eq, and, desc, isNull } from "drizzle-orm";
import type { SendRequest, SmtpVerifyRequest, SmtpTestRequest, CreateInAppNotificationRequest } from "./notifications.dto";
import type { EmailProvider, SmsProvider, PushProvider, SlackProvider } from "./utils/providers";
import {
  ConsoleEmailProvider,
  ConsoleSmsProvider,
  ConsolePushProvider,
  ConsoleSlackProvider,
  SmtpEmailProvider,
  TwilioSmsProvider,
  FcmPushProvider,
  SlackWebhookProvider,
} from "./utils/providers";


// Provider Registry
class ProviderRegistry {
  private emailProviders: Map<string, EmailProvider> = new Map();
  private smsProviders: Map<string, SmsProvider> = new Map();
  private pushProviders: Map<string, PushProvider> = new Map();
  private slackProviders: Map<string, SlackProvider> = new Map();

  constructor() {
    // Initialize console providers (default for development)
    this.emailProviders.set("console", new ConsoleEmailProvider());
    this.smsProviders.set("console", new ConsoleSmsProvider());
    this.pushProviders.set("console", new ConsolePushProvider());
    this.slackProviders.set("console", new ConsoleSlackProvider());

    // Initialize real providers if env vars are set
    this.initializeRealProviders();
  }

  private initializeRealProviders() {
    // SMTP Email Provider
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      this.emailProviders.set("smtp", new SmtpEmailProvider({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || "587"),
        secure: process.env.SMTP_SECURE === "true",
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      }));
    }

    // Twilio SMS Provider
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER) {
      this.smsProviders.set("twilio", new TwilioSmsProvider({
        accountSid: process.env.TWILIO_ACCOUNT_SID,
        authToken: process.env.TWILIO_AUTH_TOKEN,
        fromNumber: process.env.TWILIO_FROM_NUMBER,
      }));
    }

    // FCM Push Provider
    if (process.env.FCM_SERVER_KEY) {
      this.pushProviders.set("fcm", new FcmPushProvider(process.env.FCM_SERVER_KEY));
    }

    // Slack Webhook Provider
    if (process.env.SLACK_WEBHOOK_URL) {
      this.slackProviders.set("slack", new SlackWebhookProvider(process.env.SLACK_WEBHOOK_URL));
    }
  }

  getEmailProvider(provider?: string): EmailProvider {
    const key = provider || this.getDefaultEmailProvider();
    return this.emailProviders.get(key) || this.emailProviders.get("console")!;
  }

  getSmsProvider(provider?: string): SmsProvider {
    const key = provider || this.getDefaultSmsProvider();
    return this.smsProviders.get(key) || this.smsProviders.get("console")!;
  }

  getPushProvider(provider?: string): PushProvider {
    const key = provider || this.getDefaultPushProvider();
    return this.pushProviders.get(key) || this.pushProviders.get("console")!;
  }

  getSlackProvider(provider?: string): SlackProvider {
    const key = provider || this.getDefaultSlackProvider();
    return this.slackProviders.get(key) || this.slackProviders.get("console")!;
  }

  private getDefaultEmailProvider(): string {
    if (this.emailProviders.has("smtp")) return "smtp";
    return "console";
  }

  private getDefaultSmsProvider(): string {
    if (this.smsProviders.has("twilio")) return "twilio";
    return "console";
  }

  private getDefaultPushProvider(): string {
    if (this.pushProviders.has("fcm")) return "fcm";
    return "console";
  }

  private getDefaultSlackProvider(): string {
    if (this.slackProviders.has("slack")) return "slack";
    return "console";
  }
}

// Global provider registry instance
const providerRegistry = new ProviderRegistry();

export class NotificationsService {
  /**
   * Send notification through specified channels
   */
  async send(data: SendRequest, tenantId: string, context?: {
    requestId?: string;
    traceId?: string;
    correlationId?: string;
  }) {
    const results: Array<{ channel: string; success: boolean; messageId?: string; error?: string }> = [];

    // Send email notification
    if (data.email) {
      try {
        const provider = providerRegistry.getEmailProvider(data.email.provider);
        const result = await provider.send(data.email);
        
        // Store notification record (skip on dev or if provider is console)
        try {
          if (env.NODE_ENV !== 'development' && (data.email.provider || 'console') !== 'console') {
            await db.insert(notifications).values({
              tenantId,
              to: data.email.to,
              channel: 'email',
              provider: data.email.provider || "console",
              subject: data.email.subject,
              payload: data.email,
              status: 'sent',
              sentAt: new Date(),
              requestId: context?.requestId,
              traceId: context?.traceId,
              correlationId: context?.correlationId,
            });
          }
        } catch {}

        results.push({ channel: 'email', success: true, messageId: result.messageId });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        // Store failed notification record (skip on dev or console)
        try {
          if (env.NODE_ENV !== 'development' && (data.email.provider || 'console') !== 'console') {
            await db.insert(notifications).values({
              tenantId,
              to: data.email.to,
              channel: 'email',
              provider: data.email.provider || "console",
              subject: data.email.subject,
              payload: data.email,
              status: 'failed',
              errorMessage,
              requestId: context?.requestId,
              traceId: context?.traceId,
              correlationId: context?.correlationId,
            });
          }
        } catch {}

        results.push({ channel: 'email', success: false, error: errorMessage });
      }
    }

    // Send SMS notification
    if (data.sms) {
      try {
        const provider = providerRegistry.getSmsProvider(data.sms.provider);
        const result = await provider.send(data.sms);
        
        try {
          if (env.NODE_ENV !== 'development' && (data.sms.provider || 'console') !== 'console') {
            await db.insert(notifications).values({
              tenantId,
              to: data.sms.to,
              channel: 'sms',
              provider: data.sms.provider || "console",
              payload: data.sms,
              status: 'sent',
              sentAt: new Date(),
              requestId: context?.requestId,
              traceId: context?.traceId,
              correlationId: context?.correlationId,
            });
          }
        } catch {}

        results.push({ channel: 'sms', success: true, messageId: result.messageId });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        try {
          if (env.NODE_ENV !== 'development' && (data.sms.provider || 'console') !== 'console') {
            await db.insert(notifications).values({
              tenantId,
              to: data.sms.to,
              channel: 'sms',
              provider: data.sms.provider || "console",
              payload: data.sms,
              status: 'failed',
              errorMessage,
              requestId: context?.requestId,
              traceId: context?.traceId,
              correlationId: context?.correlationId,
            });
          }
        } catch {}

        results.push({ channel: 'sms', success: false, error: errorMessage });
      }
    }

    // Send push notification
    if (data.push) {
      try {
        const provider = providerRegistry.getPushProvider(data.push.provider);
        const result = await provider.send(data.push);
        
        try {
          if (env.NODE_ENV !== 'development' && (data.push.provider || 'console') !== 'console') {
            await db.insert(notifications).values({
              tenantId,
              to: data.push.to,
              channel: 'push',
              provider: data.push.provider || "console",
              subject: data.push.title,
              payload: data.push,
              status: 'sent',
              sentAt: new Date(),
              requestId: context?.requestId,
              traceId: context?.traceId,
              correlationId: context?.correlationId,
            });
          }
        } catch {}

        results.push({ channel: 'push', success: true, messageId: result.messageId });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        try {
          if (env.NODE_ENV !== 'development' && (data.push.provider || 'console') !== 'console') {
            await db.insert(notifications).values({
              tenantId,
              to: data.push.to,
              channel: 'push',
              provider: data.push.provider || "console",
              subject: data.push.title,
              payload: data.push,
              status: 'failed',
              errorMessage,
              requestId: context?.requestId,
              traceId: context?.traceId,
              correlationId: context?.correlationId,
            });
          }
        } catch {}

        results.push({ channel: 'push', success: false, error: errorMessage });
      }
    }

    // Send Slack notification
    if (data.slack) {
      try {
        const provider = providerRegistry.getSlackProvider(data.slack.provider);
        const result = await provider.send(data.slack);
        
        try {
          if (env.NODE_ENV !== 'development' && (data.slack.provider || 'console') !== 'console') {
            await db.insert(notifications).values({
              tenantId,
              to: data.slack.to,
              channel: 'slack',
              provider: data.slack.provider || "console",
              payload: data.slack,
              status: 'sent',
              sentAt: new Date(),
              requestId: context?.requestId,
              traceId: context?.traceId,
              correlationId: context?.correlationId,
            });
          }
        } catch {}

        results.push({ channel: 'slack', success: true, messageId: result.messageId });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        try {
          if (env.NODE_ENV !== 'development' && (data.slack.provider || 'console') !== 'console') {
            await db.insert(notifications).values({
              tenantId,
              to: data.slack.to,
              channel: 'slack',
              provider: data.slack.provider || "console",
              payload: data.slack,
              status: 'failed',
              errorMessage,
              requestId: context?.requestId,
              traceId: context?.traceId,
              correlationId: context?.correlationId,
            });
          }
        } catch {}

        results.push({ channel: 'slack', success: false, error: errorMessage });
      }
    }

    return results;
  }

  /**
   * Verify SMTP configuration
   */
  async verifySmtp(config: SmtpVerifyRequest): Promise<boolean> {
    try {
      const provider = new SmtpEmailProvider(config);
      return await provider.verify();
    } catch (error) {
      console.error('SMTP verification failed:', error);
      return false;
    }
  }

  /**
   * Test SMTP configuration
   */
  async testSmtp(config: SmtpTestRequest): Promise<boolean> {
    try {
      const provider = new SmtpEmailProvider({
        host: config.host,
        port: config.port,
        secure: config.secure,
        user: config.user,
        pass: config.pass,
      });

      await provider.send({
        to: config.to,
        subject: config.subject,
        text: config.text,
      });

      return true;
    } catch (error) {
      console.error('SMTP test failed:', error);
      return false;
    }
  }

  /**
   * List in-app notifications for a user
   */
  async listInAppNotifications(userId: string, tenantId: string) {
    return await db
      .select()
      .from(inAppNotifications)
      .where(and(eq(inAppNotifications.userId, userId), eq(inAppNotifications.tenantId, tenantId)))
      .orderBy(desc(inAppNotifications.createdAt));
  }

  /**
   * Mark in-app notification as read
   */
  async markInAppRead(notificationId: string, userId: string, tenantId: string): Promise<boolean> {
    const result = await db
      .update(inAppNotifications)
      .set({ readAt: new Date() })
      .where(and(
        eq(inAppNotifications.id, notificationId),
        eq(inAppNotifications.userId, userId),
        eq(inAppNotifications.tenantId, tenantId)
      ));

    return Boolean(result.rowCount && result.rowCount > 0);
  }

  /**
   * Mark all in-app notifications as read for a user
   */
  async markAllInAppRead(userId: string, tenantId: string): Promise<number> {
    const result = await db
      .update(inAppNotifications)
      .set({ readAt: new Date() })
      .where(and(
        eq(inAppNotifications.userId, userId),
        eq(inAppNotifications.tenantId, tenantId),
        isNull(inAppNotifications.readAt)
      ));

    return result.rowCount ?? 0;
  }

  /**
   * Create in-app notification
   */
  async createInAppNotification(data: CreateInAppNotificationRequest, tenantId: string) {
    const [notification] = await db
      .insert(inAppNotifications)
      .values({
        tenantId,
        userId: data.userId,
        title: data.title,
        message: data.message,
        type: data.type,
        link: data.link,
      })
      .returning();

    return notification;
  }

  async testSMTP(_config: SmtpTestRequest, _tenantId: string): Promise<boolean> {
    return this.testSmtp(_config);
  }

  async sendBulkNotification(data: { templateId: string; recipients: Array<{ id: string; email?: string; phone?: string; variables?: Record<string, unknown> }>; tenantId: string; userId?: string }) {
    const results: Array<{ recipientId: string; success: boolean; error?: string }> = [];
    for (const r of data.recipients) {
      try {
        const sendReq: SendRequest = {
          email: r.email ? { to: r.email, subject: "", text: "" } : undefined,
          sms: r.phone ? { to: r.phone, text: "" } : undefined,
        };
        await this.send(sendReq, data.tenantId);
        results.push({ recipientId: r.id, success: true });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        results.push({ recipientId: r.id, success: false, error: msg });
      }
    }
    return { count: results.length, results };
  }

  async getNotifications(params: { tenantId: string; userId?: string; page?: number; limit?: number; type?: string; status?: string; isRead?: boolean }) {
    const page = params.page && params.page > 0 ? params.page : 1;
    const limit = params.limit && params.limit > 0 ? params.limit : 20;
    const rows = await db
      .select()
      .from(notifications)
      .where(eq(notifications.tenantId, params.tenantId))
      .orderBy(desc(notifications.createdAt));
    const start = (page - 1) * limit;
    return { total: rows.length, page, limit, data: rows.slice(start, start + limit) };
  }

  async getNotificationById(id: string, tenantId: string, _userId?: string) {
    const rows = await db
      .select()
      .from(notifications)
      .where(and(eq(notifications.id, id), eq(notifications.tenantId, tenantId)))
      .limit(1);
    return rows[0] ?? null;
  }

  async markAsRead(id: string, tenantId: string, userId?: string, isRead?: boolean) {
    const readAt = isRead === false ? null : new Date();
    const res = await db
      .update(notifications)
      .set({ deliveredAt: readAt })
      .where(and(eq(notifications.id, id), eq(notifications.tenantId, tenantId)));
    return (res.rowCount ?? 0) > 0;
  }

  async deleteNotification(id: string, tenantId: string, _userId?: string) {
    const res = await db
      .delete(notifications)
      .where(and(eq(notifications.id, id), eq(notifications.tenantId, tenantId)));
    return (res.rowCount ?? 0) > 0;
  }

  async getTemplates(_params: { tenantId: string; page?: number; limit?: number; type?: string }) {
    return { total: 0, page: 1, limit: 0, data: [] } as const;
  }

  async getTemplateById(_id: string, _tenantId: string) {
    return null;
  }

  async createTemplate(_data: { name: string; subject: string; content: string; type: string; variables?: string[]; tenantId: string; createdBy?: string }) {
    return null;
  }

  async updateTemplate(_id: string, _tenantId: string, _data: { name?: string; subject?: string; content?: string; type?: string; variables?: string[] }) {
    return null;
  }

  async deleteTemplate(_id: string, _tenantId: string) {
    return true;
  }

  async getInAppNotifications(params: { tenantId: string; userId: string; page?: number; limit?: number; isRead?: boolean }) {
    const rows = await this.listInAppNotifications(params.userId, params.tenantId);
    const filtered = params.isRead === undefined ? rows : rows.filter((r) => Boolean(r.readAt) === params.isRead);
    const page = params.page && params.page > 0 ? params.page : 1;
    const limit = params.limit && params.limit > 0 ? params.limit : 20;
    const start = (page - 1) * limit;
    return { total: filtered.length, page, limit, data: filtered.slice(start, start + limit) };
  }

  async markInAppAsRead(id: string, tenantId: string, userId: string) {
    return this.markInAppRead(id, userId, tenantId);
  }

  async getUnreadCount(tenantId: string, userId: string) {
    const rows = await this.listInAppNotifications(userId, tenantId);
    return rows.filter((r) => !r.readAt).length;
  }
}