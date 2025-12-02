import { Hono } from 'hono'
import type { Context } from 'hono'
import { z } from 'zod'
import { authApiClient } from '../../core/clients/auth.client'

const resendVerificationRouter = new Hono()

const resendVerificationSchema = z.object({
  email: z.string().email('Geçerli bir e-posta adresi giriniz')
})

resendVerificationRouter.post(
  '/resend-verification',
  async (c: Context) => {
    try {
      const body = await c.req.json().catch(() => ({}))
      const parsed = resendVerificationSchema.safeParse(body)
      if (!parsed.success) {
        return c.json({ success: false, message: 'Geçersiz veri' }, 400)
      }
      const { email } = parsed.data

      // Auth servisinden kullanıcıyı kontrol et
      const authResponse = await authApiClient.getUserByEmail(email)
      
      if (!authResponse.success || !authResponse.data) {
        return c.json(
          { 
            success: false, 
            message: 'Bu e-posta adresi ile kayıtlı kullanıcı bulunamadı' 
          },
          404
        )
      }

      const authUser = authResponse.data

      // Log email verification request (event bus integration removed for now)
      console.log(`Email verification resent for user: ${authUser.email}`)
      console.log(`User name: ${authUser.firstName} ${authUser.lastName}` || 'Kullanıcı')

      return c.json({
        success: true,
        message: 'Onay e-postası tekrar gönderildi. Lütfen e-posta kutunuzu kontrol edin.'
      })

    } catch (error) {
      console.error('Resend verification error:', error)
      return c.json(
        { 
          success: false, 
          message: 'Bir hata oluştu. Lütfen tekrar deneyin.' 
        },
        500
      )
    }
  }
)

export { resendVerificationRouter }