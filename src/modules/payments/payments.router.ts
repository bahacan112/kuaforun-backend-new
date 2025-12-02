import { Hono } from "hono";
import type { Context } from "hono";
import { z } from "zod";
import { tenantMiddleware } from "../../core/middleware/tenant.middleware";
import { authMiddleware } from "../../core/middleware/auth.middleware";
import { jsonOk, jsonErr } from "../../utils/api-response";
import { paymentService } from "./payments.service";

// Payment schemas
const createPaymentIntentSchema = z.object({
  amount: z.number().positive().int(),
  currency: z.string().default("try"),
  bookingId: z.string().optional(),
  metadata: z.record(z.string(), z.string()).optional(),
});

const confirmPaymentSchema = z.object({
  paymentIntentId: z.string(),
  paymentMethodId: z.string(),
});

// Payment router
export const paymentRouter = new Hono<{
  Variables: {
    userId: string;
    userEmail: string;
    tenantId: string;
    userName?: string;
  };
}>();

// Apply middleware
paymentRouter.use("/*", tenantMiddleware);

// Create payment intent
paymentRouter.post(
  "/create-intent",
  authMiddleware,
  async (c: Context) => {
    try {
      const body = await c.req.json().catch(() => ({} as unknown));
      const parsed = createPaymentIntentSchema.safeParse(body);
      if (!parsed.success) {
        return c.json(jsonErr("Geçersiz veri"), 400);
      }
      const { amount, currency, bookingId, metadata } = parsed.data;
      const userId = c.get("userId");
      const tenantId = c.get("tenantId");
      const userEmail = c.get("userEmail");

      // Create or update customer first
      await paymentService.createOrUpdateCustomer({
        userId,
        email: userEmail,
        tenantId,
      });

      // Create payment intent
      const result = await paymentService.createPaymentIntent({
        amount,
        currency,
        userId,
        bookingId,
        tenantId,
        metadata,
      });

      return c.json(jsonOk(result));
    } catch (error) {
      console.error("Error creating payment intent:", error);
      return c.json(jsonErr("Ödeme intenti oluşturulamadı"), 500);
    }
  }
);

// Confirm payment
paymentRouter.post(
  "/confirm",
  authMiddleware,
  async (c: Context) => {
    try {
      const body = await c.req.json().catch(() => ({} as unknown));
      const parsed = confirmPaymentSchema.safeParse(body);
      if (!parsed.success) {
        return c.json(jsonErr("Geçersiz veri"), 400);
      }
      const { paymentIntentId, paymentMethodId } = parsed.data;
      const userId = c.get("userId");

      // Confirm the payment
      const result = await paymentService.confirmPayment({
        paymentIntentId,
        paymentMethodId,
        userId,
      });

      return c.json(jsonOk(result));
    } catch (error) {
      console.error("Error confirming payment:", error);
      return c.json(jsonErr("Ödeme onaylanamadı"), 500);
    }
  }
);

// Get payment status
paymentRouter.get(
  "/status/:paymentIntentId",
  authMiddleware,
  async (c: Context) => {
    try {
      const paymentIntentId = c.req.param("paymentIntentId");
      const userId = c.get("userId");

      const result = await paymentService.getPaymentStatus({
        paymentIntentId,
        userId,
      });

      return c.json(jsonOk(result));
    } catch (error) {
      console.error("Error retrieving payment status:", error);
      if (error instanceof Error && error.message.includes("Unauthorized")) {
        return c.json(jsonErr("Bu ödemeyi görüntüleme yetkiniz yok"), 403);
      }
      return c.json(jsonErr("Ödeme durumu alınamadı"), 500);
    }
  }
);

// Get payment methods for user
paymentRouter.get(
  "/methods",
  authMiddleware,
  async (c: Context) => {
    try {
      const userId = c.get("userId");
      const paymentMethods = await paymentService.getUserPaymentMethods(userId);
      return c.json(jsonOk({ paymentMethods }));
    } catch (error) {
      console.error("Error listing payment methods:", error);
      return c.json(jsonErr("Ödeme yöntemleri alınamadı"), 500);
    }
  }
);

// Create customer (if needed)
paymentRouter.post(
  "/create-customer",
  authMiddleware,
  async (c) => {
    try {
      const userId = c.get("userId");
      const userEmail = c.get("userEmail");
      const tenantId = c.get("tenantId");
      const userName = c.get("userName");

      const result = await paymentService.createOrUpdateCustomer({
        userId,
        email: userEmail,
        tenantId,
        name: userName,
      });

      return c.json(jsonOk(result));
    } catch (error) {
      console.error("Error creating customer:", error);
      return c.json(jsonErr("Müşteri oluşturulamadı"), 500);
    }
  }
);

export default paymentRouter;