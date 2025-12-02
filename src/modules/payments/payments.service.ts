import Stripe from "stripe"
import { db } from "../../db"
import { bookings } from "../../db/schema"
import { eq } from "drizzle-orm"
import type { BookingStatusType } from "../../db/schema"

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2025-10-29.clover",
})

export class PaymentService {
  /**
   * Create a payment intent for a booking
   */
  async createPaymentIntent(params: {
    amount: number
    currency: string
    userId: string
    bookingId?: string
    tenantId: string
    metadata?: Record<string, string>
  }) {
    const { amount, currency, userId, bookingId, tenantId, metadata } = params

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount * 100, // Convert to cents
      currency: currency.toLowerCase(),
      customer: userId,
      metadata: {
        userId,
        tenantId,
        bookingId: bookingId || "",
        ...metadata,
      },
      automatic_payment_methods: {
        enabled: true,
      },
    })

    return {
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      status: paymentIntent.status,
    }
  }

  /**
   * Confirm a payment intent
   */
  async confirmPayment(params: {
    paymentIntentId: string
    paymentMethodId: string
    userId: string
  }) {
    const { paymentIntentId, paymentMethodId, userId } = params

    // Verify the payment intent belongs to the user
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId)
    
    if (paymentIntent.metadata.userId !== userId) {
      throw new Error("Unauthorized access to payment intent")
    }

    // Confirm the payment
    const confirmedIntent = await stripe.paymentIntents.confirm(paymentIntentId, {
      payment_method: paymentMethodId,
    })

    // Update booking status if payment is successful
    if (confirmedIntent.status === "succeeded" && confirmedIntent.metadata.bookingId) {
      await this.updateBookingPaymentStatus(confirmedIntent.metadata.bookingId, "paid")
    }

    return {
      paymentIntentId: confirmedIntent.id,
      status: confirmedIntent.status,
      amount: confirmedIntent.amount,
      currency: confirmedIntent.currency,
    }
  }

  /**
   * Get payment intent status
   */
  async getPaymentStatus(params: {
    paymentIntentId: string
    userId: string
  }) {
    const { paymentIntentId, userId } = params

    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId)

    // Verify ownership
    if (paymentIntent.metadata.userId !== userId) {
      throw new Error("Unauthorized access to payment intent")
    }

    return {
      paymentIntentId: paymentIntent.id,
      status: paymentIntent.status,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      created: paymentIntent.created,
      metadata: paymentIntent.metadata,
    }
  }

  /**
   * Get user's payment methods
   */
  async getUserPaymentMethods(userId: string) {
    try {
      const paymentMethods = await stripe.paymentMethods.list({
        customer: userId,
        type: "card",
      })

      return paymentMethods.data.map(pm => ({
        id: pm.id,
        type: pm.type,
        card: pm.card ? {
          brand: pm.card.brand,
          last4: pm.card.last4,
          expMonth: pm.card.exp_month,
          expYear: pm.card.exp_year,
        } : null,
      }))
    } catch {
      // If customer doesn't exist, return empty array
      return []
    }
  }

  /**
   * Create or update Stripe customer
   */
  async createOrUpdateCustomer(params: {
    userId: string
    email: string
    tenantId: string
    name?: string
  }) {
    const { userId, email, tenantId, name } = params

    try {
      // Try to retrieve existing customer
      const customers = await stripe.customers.list({
        email: email,
        limit: 1,
      })

      let customer

      if (customers.data.length > 0) {
        // Update existing customer
        customer = await stripe.customers.update(customers.data[0].id, {
          metadata: {
            userId,
            tenantId,
          },
        })
      } else {
        // Create new customer
        customer = await stripe.customers.create({
          email: email,
          name: name,
          metadata: {
            userId,
            tenantId,
          },
        })
      }

      return {
        customerId: customer.id,
        email: customer.email,
        name: customer.name,
      }
    } catch (error) {
      console.error("Error creating/updating customer:", error)
      throw new Error("Failed to create or update customer")
    }
  }

  /**
   * Process refund for a booking
   */
  async processRefund(params: {
    bookingId: string
    amount?: number
    reason?: string
  }) {
    const { bookingId, amount, reason } = params

    // Find payment intent by booking ID
    const paymentIntents = await stripe.paymentIntents.list({
      limit: 100, // Get more results to search through
    })
    
    // Filter by metadata manually since Stripe API doesn't support metadata filtering in list
    const paymentIntent = paymentIntents.data.find(pi => 
      pi.metadata && pi.metadata.bookingId === bookingId
    )

    if (!paymentIntent) {
      throw new Error("No payment found for this booking")
    }

    // Create refund
    const refund = await stripe.refunds.create({
      payment_intent: paymentIntent.id,
      amount: amount ? amount * 100 : undefined, // Convert to cents if specified
      reason: reason ? "requested_by_customer" : undefined,
      metadata: {
        bookingId,
        refundReason: reason || "customer_request",
      },
    })

    // Update booking status
    await this.updateBookingPaymentStatus(bookingId, "refunded")

    return {
      refundId: refund.id,
      amount: refund.amount,
      currency: refund.currency,
      status: refund.status,
      reason: refund.reason,
    }
  }

  /**
   * Update booking payment status
   */
  private async updateBookingPaymentStatus(
    bookingId: string,
    status: BookingStatusType
  ) {
    try {
      await db.update(bookings)
        .set({ 
          status,
          updatedAt: new Date(),
        })
        .where(eq(bookings.id, bookingId))
    } catch (error) {
      console.error("Error updating booking payment status:", error)
      // Don't throw error here, as payment was already processed
    }
  }
}

export const paymentService = new PaymentService()