// Payment Data Transfer Objects
import { z } from "zod"

// Payment intent creation schema
export const createPaymentIntentSchema = z.object({
  amount: z.number().positive().int(),
  currency: z.string().default("try"),
  bookingId: z.string().uuid().optional(),
  metadata: z.record(z.string(), z.string()).optional(),
})

export type CreatePaymentIntentDto = z.infer<typeof createPaymentIntentSchema>

// Payment confirmation schema
export const confirmPaymentSchema = z.object({
  paymentIntentId: z.string(),
  paymentMethodId: z.string(),
})

export type ConfirmPaymentDto = z.infer<typeof confirmPaymentSchema>

// Payment status response
export interface PaymentStatusResponse {
  paymentIntentId: string
  status: string
  amount: number
  currency: string
  created: number
  metadata?: Record<string, string>
}

// Payment method response
export interface PaymentMethodResponse {
  id: string
  type: string
  card?: {
    brand: string
    last4: string
    expMonth: number
    expYear: number
  }
}

// Customer creation response
export interface CreateCustomerResponse {
  customerId: string
  email?: string
}

// Payment intent response
export interface PaymentIntentResponse {
  clientSecret: string
  paymentIntentId: string
  amount: number
  currency: string
  status: string
}