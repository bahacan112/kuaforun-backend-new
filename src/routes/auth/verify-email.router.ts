import { Hono } from "hono";
import type { Context } from "hono";
import { z } from "zod";
import { jsonErr, jsonOk } from "../../utils/api-response";


const verifyEmailRouter = new Hono();

const verifyEmailSchema = z.object({
  email: z.string().email("Geçerli bir e-posta adresi giriniz"),
  code: z.string().min(6, "Onay kodu en az 6 karakter olmalıdır"),
});

verifyEmailRouter.post("/verify-email", async (c: Context) => {
  try {
    const body = await c.req.json();
    const parsed = verifyEmailSchema.safeParse(body);

    if (!parsed.success) {
      return c.json(
        jsonErr("Geçersiz veri", "VALIDATION_ERROR"),
        400
      );
    }

    const { email, code } = parsed.data;

    // Auth servisine doğrulama isteği gönder
    const authServiceUrl = process.env.AUTH_SERVICE_URL || "http://auth:3002";
    
    try {
      const authResponse = await fetch(`${authServiceUrl}/verify-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, code }),
      });

      if (!authResponse.ok) {
        const errorData = await authResponse.json() as { message?: string };
        return c.json(
          jsonErr(errorData.message || "E-posta onaylama başarısız", "VERIFICATION_FAILED"),
          400
        );
      }

      // Auth servisinde onaylama başarılı oldu
      // Backend'de ayrıca bir işlem yapmaya gerek yok çünkü
      // email doğrulama durumu auth servisinde tutuluyor

      return c.json(
        jsonOk({
          message: "E-posta adresiniz başarıyla onaylandı",
          verified: true,
        })
      );
    } catch (authError) {
      console.error("Auth service error:", authError);
      return c.json(
        jsonErr("E-posta onaylama servisine ulaşılamıyor", "SERVICE_UNAVAILABLE"),
        503
      );
    }
  } catch (error) {
    console.error("Verify email error:", error);
    return c.json(
      jsonErr("E-posta onaylama sırasında bir hata oluştu", "INTERNAL_ERROR"),
      500
    );
  }
});

export { verifyEmailRouter };