import type { Context, Next } from "hono";
import { localAuthClient } from "../clients/local-auth.client";

/**
 * Auth middleware - Token doğrulama ve kullanıcı bilgilerini context'e ekleme
 */
export async function authMiddleware(c: Context, next: Next) {
  try {
    // Authorization header'ından token'ı al
    const authHeader = c.req.header("Authorization");
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return c.json(
        {
          success: false,
          error: { message: "Authorization token required" },
        },
        401
      );
    }

    const token = authHeader.substring(7); // "Bearer " kısmını kaldır

    // Auth servisinden token'ı doğrula
    const authResponse = await localAuthClient.validateToken(token);

    if (!authResponse.success || !authResponse.data) {
      return c.json(
        {
          success: false,
          error: { message: "Invalid or expired token" },
        },
        401
      );
    }

    const authUser = authResponse.data;

    // Kullanıcı bilgilerini context'e ekle
    c.set("authUser", authUser);
    c.set("userId", authUser.id);
    c.set("userEmail", authUser.email);
    c.set("userRole", authUser.role);

    await next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    return c.json(
      {
        success: false,
        error: { message: "Authentication failed" },
      },
      401
    );
  }
}

/**
 * Optional auth middleware - Token varsa doğrula, yoksa devam et
 */
export async function optionalAuthMiddleware(c: Context, next: Next) {
  try {
    const authHeader = c.req.header("Authorization");
    
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      const authResponse = await localAuthClient.validateToken(token);
      
      if (authResponse.success && authResponse.data) {
        const authUser = authResponse.data;
        c.set("authUser", authUser);
        c.set("userId", authUser.id);
        c.set("userEmail", authUser.email);
        c.set("userRole", authUser.role);
      }
    }

    await next();
  } catch (error) {
    console.error("Optional auth middleware error:", error);
    // Hata durumunda da devam et
    await next();
  }
}