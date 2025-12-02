import type { Context } from 'hono';
import { z } from 'zod';
import { NotificationsService } from './notifications.service';
import { 
  SendSchema, 
  CreateTemplateSchema, 
  UpdateTemplateSchema,
  SendBulkNotificationSchema,
  MarkAsReadSchema 
} from './notifications.dto';
import { HTTPException } from 'hono/http-exception';

const notificationsService = new NotificationsService();

export class NotificationsController {
  async sendNotification(c: Context) {
    try {
      const body = await c.req.json();
      const validatedData = SendSchema.parse(body);
      const tenantId = String(c.get('tenantId') ?? 'main');
      const _userId = String(c.get('userId') ?? '');
      const role = String(c.get('userRole') ?? '');
      if (role === 'customer') {
        throw new HTTPException(403, { message: 'Forbidden' });
      }

      const result = await notificationsService.send(validatedData, tenantId, {
        requestId: c.get('requestId'),
        traceId: c.get('traceId'),
        correlationId: c.get('correlationId')
      });

      return c.json({
        success: true,
        data: result
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new HTTPException(400, { message: 'Validation error', cause: error });
      }
      throw error;
    }
  }

  async sendBulkNotification(c: Context) {
    try {
      const body = await c.req.json();
      const validatedData = SendBulkNotificationSchema.parse(body);
      const tenantId = c.get('tenantId');
      const userId = c.get('userId');
      const role = String(c.get('userRole') ?? '');
      if (role === 'customer') {
        throw new HTTPException(403, { message: 'Forbidden' });
      }

      const result = await notificationsService.sendBulkNotification({
        ...validatedData,
        tenantId,
        userId
      });

      return c.json({
        success: true,
        data: result
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new HTTPException(400, { message: 'Validation error', cause: error });
      }
      throw error;
    }
  }

  async getNotifications(c: Context) {
    try {
      const tenantId = c.get('tenantId');
      const userId = c.get('userId');
      const page = parseInt(c.req.query('page') || '1');
      const limit = parseInt(c.req.query('limit') || '20');
      const type = c.req.query('type');
      const status = c.req.query('status');
      const isRead = c.req.query('isRead');

      const result = await notificationsService.getNotifications({
        tenantId,
        userId,
        page,
        limit,
        type: type || undefined,
        status: status || undefined,
        isRead: isRead ? isRead === 'true' : undefined
      });

      return c.json({
        success: true,
        data: result
      });
    } catch (error) {
      throw error;
    }
  }

  async getNotificationById(c: Context) {
    try {
      const id = c.req.param('id');
      const tenantId = c.get('tenantId');
      const userId = c.get('userId');

      const notification = await notificationsService.getNotificationById(id, tenantId, userId);

      if (!notification) {
        throw new HTTPException(404, { message: 'Notification not found' });
      }

      return c.json({
        success: true,
        data: notification
      });
    } catch (error) {
      throw error;
    }
  }

  async markAsRead(c: Context) {
    try {
      const id = c.req.param('id');
      const body = await c.req.json();
      const _validatedData = MarkAsReadSchema.parse(body);
      const tenantId = c.get('tenantId');
      const userId = c.get('userId');

      const result = await notificationsService.markAsRead(id, tenantId, userId, true);

      return c.json({
        success: true,
        data: result
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new HTTPException(400, { message: 'Validation error', cause: error });
      }
      throw error;
    }
  }

  async deleteNotification(c: Context) {
    try {
      const id = c.req.param('id');
      const tenantId = c.get('tenantId');
      const userId = c.get('userId');

      await notificationsService.deleteNotification(id, tenantId, userId);

      return c.json({
        success: true,
        message: 'Notification deleted successfully'
      });
    } catch (error) {
      throw error;
    }
  }

  async getTemplates(c: Context) {
    try {
      const tenantId = c.get('tenantId');
      const page = parseInt(c.req.query('page') || '1');
      const limit = parseInt(c.req.query('limit') || '20');
      const type = c.req.query('type');

      const result = await notificationsService.getTemplates({
        tenantId,
        page,
        limit,
        type: type || undefined
      });

      return c.json({
        success: true,
        data: result
      });
    } catch (error) {
      throw error;
    }
  }

  async getTemplateById(c: Context) {
    try {
      const id = c.req.param('id');
      const tenantId = c.get('tenantId');

      const template = await notificationsService.getTemplateById(id, tenantId);

      if (!template) {
        throw new HTTPException(404, { message: 'Template not found' });
      }

      return c.json({
        success: true,
        data: template
      });
    } catch (error) {
      throw error;
    }
  }

  async createTemplate(c: Context) {
    try {
      const body = await c.req.json();
      const validatedData = CreateTemplateSchema.parse(body);
      const tenantId = c.get('tenantId');
      const userId = c.get('userId');
      const role = String(c.get('userRole') ?? '');
      if (role === 'customer') {
        throw new HTTPException(403, { message: 'Forbidden' });
      }

      const result = await notificationsService.createTemplate({
        ...validatedData,
        tenantId,
        createdBy: userId
      });

      return c.json({
        success: true,
        data: result
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new HTTPException(400, { message: 'Validation error', cause: error });
      }
      throw error;
    }
  }

  async updateTemplate(c: Context) {
    try {
      const id = c.req.param('id');
      const body = await c.req.json();
      const validatedData = UpdateTemplateSchema.parse(body);
      const tenantId = c.get('tenantId');
      const role = String(c.get('userRole') ?? '');
      if (role === 'customer') {
        throw new HTTPException(403, { message: 'Forbidden' });
      }

      const result = await notificationsService.updateTemplate(id, tenantId, validatedData);

      return c.json({
        success: true,
        data: result
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new HTTPException(400, { message: 'Validation error', cause: error });
      }
      throw error;
    }
  }

  async deleteTemplate(c: Context) {
    try {
      const id = c.req.param('id');
      const tenantId = c.get('tenantId');
      const role = String(c.get('userRole') ?? '');
      if (role === 'customer') {
        throw new HTTPException(403, { message: 'Forbidden' });
      }

      await notificationsService.deleteTemplate(id, tenantId);

      return c.json({
        success: true,
        message: 'Template deleted successfully'
      });
    } catch (error) {
      throw error;
    }
  }

  async testSMTP(c: Context) {
    try {
      const body = await c.req.json();
      const { smtpConfig } = body;
      const tenantId = c.get('tenantId');
      const role = String(c.get('userRole') ?? '');
      if (role === 'customer') {
        throw new HTTPException(403, { message: 'Forbidden' });
      }

      const result = await notificationsService.testSMTP(smtpConfig, tenantId);

      return c.json({
        success: true,
        data: result
      });
    } catch (error) {
      throw error;
    }
  }

  async getInAppNotifications(c: Context) {
    try {
      const tenantId = c.get('tenantId');
      const userId = c.get('userId');
      const page = parseInt(c.req.query('page') || '1');
      const limit = parseInt(c.req.query('limit') || '20');
      const isRead = c.req.query('isRead');

      const result = await notificationsService.getInAppNotifications({
        tenantId,
        userId,
        page,
        limit,
        isRead: isRead ? isRead === 'true' : undefined
      });

      return c.json({
        success: true,
        data: result
      });
    } catch (error) {
      throw error;
    }
  }

  async markInAppAsRead(c: Context) {
    try {
      const id = c.req.param('id');
      const tenantId = c.get('tenantId');
      const userId = c.get('userId');

      const result = await notificationsService.markInAppAsRead(id, tenantId, userId);

      return c.json({
        success: true,
        data: result
      });
    } catch (error) {
      throw error;
    }
  }

  async getUnreadCount(c: Context) {
    try {
      const tenantId = c.get('tenantId');
      const userId = c.get('userId');

      const count = await notificationsService.getUnreadCount(tenantId, userId);

      return c.json({
        success: true,
        data: { count }
      });
    } catch (error) {
      throw error;
    }
  }

  async realtimeSSE(c: Context) {
    try {
      const url = new URL(c.req.url)
      const qpUserId = url.searchParams.get('userId') || c.get('userId') || ''
      const qpTenantId = url.searchParams.get('tenantId') || c.get('tenantId') || 'main'
      const userId = String(qpUserId)
      const tenantId = String(qpTenantId)
      if (!userId) {
        return c.json({ error: 'userId gerekli' }, 400)
      }
      const ctxUserId = String(c.get('userId') || '')
      if (ctxUserId && userId !== ctxUserId) {
        return c.json({ error: 'Forbidden' }, 403)
      }

      let hb: NodeJS.Timeout | null = null;
      let poll: NodeJS.Timeout | null = null;
      const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
          const enc = new TextEncoder()
          function send(data: unknown) {
            const payload = typeof data === 'string' ? data : JSON.stringify(data)
            controller.enqueue(enc.encode(`data: ${payload}\n\n`))
          }
          // Initial batch: unread notifications
          try {
            const initial = await notificationsService.getInAppNotifications({ tenantId, userId, isRead: false, page: 1, limit: 50 })
            for (const n of initial.data) {
              send({ id: n.id, title: n.title, message: n.message, type: n.type, link: n.link, createdAt: n.createdAt })
            }
          } catch {}
          // Heartbeat
          hb = setInterval(() => {
            send({ type: 'heartbeat', ts: Date.now() })
          }, 25000)
          // Periodic poll for new unread items
          poll = setInterval(() => {
            notificationsService
              .getInAppNotifications({ tenantId, userId, isRead: false, page: 1, limit: 10 })
              .then((res) => {
                for (const n of res.data) {
                  send({ id: n.id, title: n.title, message: n.message, type: n.type, link: n.link, createdAt: n.createdAt })
                }
              })
              .catch(() => {})
          }, 15000)
        },
        cancel() {
          if (hb) clearInterval(hb)
          if (poll) clearInterval(poll)
        }
      })
      return c.newResponse(stream, 200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      })
    } catch (error) {
      throw error
    }
  }
}

export const notificationsController = new NotificationsController();