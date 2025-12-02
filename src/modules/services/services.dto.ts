import { z } from 'zod'

export const ServiceCreateDto = z.object({
  barberShopId: z.string().uuid("Invalid shop ID format"),
  name: z.string().min(1),
  price: z.number().nonnegative(),
  durationMinutes: z.number().int().positive(),
})

export type ServiceCreateInput = z.infer<typeof ServiceCreateDto>

export const ServiceUpdateDto = ServiceCreateDto.partial()
export type ServiceUpdateInput = z.infer<typeof ServiceUpdateDto>

export const ServiceTemplateCreateDto = z.object({
  type: z.enum(['male','female','unisex']),
  serviceName: z.string().min(1),
  durationMinutes: z.number().int().positive(),
  price: z.number().nonnegative(),
  description: z.string().optional(),
  category: z.string().optional(),
})
export type ServiceTemplateCreateInput = z.infer<typeof ServiceTemplateCreateDto>

export const ServiceTemplateUpdateDto = ServiceTemplateCreateDto.partial()
export type ServiceTemplateUpdateInput = z.infer<typeof ServiceTemplateUpdateDto>

export const ApplyServiceTemplateDto = z.object({
  shopId: z.string().uuid('Invalid shop ID format'),
  type: z.enum(['male','female','unisex']).optional(),
})
export type ApplyServiceTemplateInput = z.infer<typeof ApplyServiceTemplateDto>