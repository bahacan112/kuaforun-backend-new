import { createTransport } from "nodemailer";
import type { Transporter } from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";

// API Response Interfaces
interface TwilioResponse {
  sid: string;
}

interface FCMResponse {
  message_id: string;
}

// Email Provider Interface
export interface EmailProvider {
  send(params: {
    to: string;
    subject: string;
    text?: string;
    html?: string;
  }): Promise<{ messageId: string }>;
}

// Console Email Provider (for development)
export class ConsoleEmailProvider implements EmailProvider {
  async send(params: {
    to: string;
    subject: string;
    text?: string;
    html?: string;
  }): Promise<{ messageId: string }> {
    console.log(`[ConsoleEmailProvider] Sending email to: ${params.to}`);
    console.log(`Subject: ${params.subject}`);
    if (params.text) console.log(`Text: ${params.text}`);
    if (params.html) console.log(`HTML: ${params.html}`);
    
    return { messageId: `console-${Date.now()}` };
  }
}

// SMTP Email Provider
export class SmtpEmailProvider implements EmailProvider {
  private transporter: Transporter<SMTPTransport.SentMessageInfo>;

  constructor(config: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    pass: string;
  }) {
    this.transporter = createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.user,
        pass: config.pass,
      },
    });
  }

  async send(params: {
    to: string;
    subject: string;
    text?: string;
    html?: string;
  }): Promise<{ messageId: string }> {
    const result = await this.transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: params.to,
      subject: params.subject,
      text: params.text,
      html: params.html,
    });

    return { messageId: result.messageId };
  }

  async verify(): Promise<boolean> {
    try {
      await this.transporter.verify();
      return true;
    } catch (error) {
      console.error('SMTP verification failed:', error);
      return false;
    }
  }
}

// SMS Provider Interface
export interface SmsProvider {
  send(params: { to: string; text: string }): Promise<{ messageId: string }>;
}

// Console SMS Provider
export class ConsoleSmsProvider implements SmsProvider {
  async send(params: { to: string; text: string }): Promise<{ messageId: string }> {
    console.log(`[ConsoleSmsProvider] Sending SMS to: ${params.to}`);
    console.log(`Text: ${params.text}`);
    
    return { messageId: `console-sms-${Date.now()}` };
  }
}

// Twilio SMS Provider
export class TwilioSmsProvider implements SmsProvider {
  private accountSid: string;
  private authToken: string;
  private fromNumber: string;

  constructor(config: {
    accountSid: string;
    authToken: string;
    fromNumber: string;
  }) {
    this.accountSid = config.accountSid;
    this.authToken = config.authToken;
    this.fromNumber = config.fromNumber;
  }

  async send(params: { to: string; text: string }): Promise<{ messageId: string }> {
    // Simple HTTP implementation for Twilio
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          From: this.fromNumber,
          To: params.to,
          Body: params.text,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Twilio API error: ${response.statusText}`);
    }

    const result = await response.json() as TwilioResponse;
    return { messageId: result.sid };
  }
}

// Push Provider Interface
export interface PushProvider {
  send(params: {
    to: string; // FCM token or user ID
    title: string;
    body: string;
    data?: Record<string, unknown>;
  }): Promise<{ messageId: string }>;
}

// Console Push Provider
export class ConsolePushProvider implements PushProvider {
  async send(params: {
    to: string;
    title: string;
    body: string;
    data?: Record<string, unknown>;
  }): Promise<{ messageId: string }> {
    console.log(`[ConsolePushProvider] Sending push notification to: ${params.to}`);
    console.log(`Title: ${params.title}`);
    console.log(`Body: ${params.body}`);
    if (params.data) console.log(`Data: ${JSON.stringify(params.data)}`);
    
    return { messageId: `console-push-${Date.now()}` };
  }
}

// FCM Push Provider
export class FcmPushProvider implements PushProvider {
  private serverKey: string;

  constructor(serverKey: string) {
    this.serverKey = serverKey;
  }

  async send(params: {
    to: string;
    title: string;
    body: string;
    data?: Record<string, unknown>;
  }): Promise<{ messageId: string }> {
    const response = await fetch('https://fcm.googleapis.com/fcm/send', {
      method: 'POST',
      headers: {
        'Authorization': `key=${this.serverKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: params.to,
        notification: {
          title: params.title,
          body: params.body,
        },
        data: params.data,
      }),
    });

    if (!response.ok) {
      throw new Error(`FCM API error: ${response.statusText}`);
    }

    const result = await response.json() as FCMResponse;
    return { messageId: result.message_id };
  }
}

// Slack Provider Interface
export interface SlackProvider {
  send(params: { to: string; text: string }): Promise<{ messageId: string }>;
}

// Console Slack Provider
export class ConsoleSlackProvider implements SlackProvider {
  async send(params: { to: string; text: string }): Promise<{ messageId: string }> {
    console.log(`[ConsoleSlackProvider] Sending Slack message to: ${params.to}`);
    console.log(`Text: ${params.text}`);
    
    return { messageId: `console-slack-${Date.now()}` };
  }
}

// Slack Webhook Provider
export class SlackWebhookProvider implements SlackProvider {
  private webhookUrl: string;

  constructor(webhookUrl: string) {
    this.webhookUrl = webhookUrl;
  }

  async send(params: { to: string; text: string }): Promise<{ messageId: string }> {
    const response = await fetch(this.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channel: params.to,
        text: params.text,
      }),
    });

    if (!response.ok) {
      throw new Error(`Slack webhook error: ${response.statusText}`);
    }

    return { messageId: `slack-${Date.now()}` };
  }
}