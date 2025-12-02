import type { Context } from "hono";
import { resolveTenantId } from "../../core/clients/auth.client";
import { jsonErr, jsonOk } from "../../utils/api-response";
import { AuthService } from "./auth.service";
import {
  RegisterSchema,
  LoginSchema,
  VerifyEmailSchema,
  ResendEmailSchema,
  PhoneStartSchema,
  PhoneVerifySchema,
  LoginByPhoneSchema,
  EmailPasswordResetStartSchema,
  VerifyEmailPasswordResetSchema,
  ResetPasswordByEmailSchema,
  PhonePasswordResetStartSchema,
  VerifyPhonePasswordResetSchema,
  ResetPasswordByPhoneSchema,
} from "./auth.dto";
import type { JwtPayload } from "./auth.dto";
import { signRefreshToken, verifyToken, REFRESH_TTL_SECONDS } from "./utils/jwt.util";
import { kvSet } from "./utils/kv.util";

const authService = new AuthService();

// Refresh token cookie configuration (can be overridden via env)
const REFRESH_COOKIE_NAME = process.env.REFRESH_COOKIE_NAME || "refresh_token";
const REFRESH_COOKIE_SECURE = (process.env.REFRESH_COOKIE_SECURE || "false").toLowerCase() === "true";
const REFRESH_COOKIE_PATH = process.env.REFRESH_COOKIE_PATH || "/";

function buildSetCookie(
  name: string,
  value: string,
  opts?: {
    httpOnly?: boolean;
    secure?: boolean;
    path?: string;
    maxAge?: number; // seconds
    sameSite?: "Lax" | "Strict" | "None";
    domain?: string;
  }
): string {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  if (opts?.httpOnly !== false) parts.push("HttpOnly");
  if (opts?.secure) parts.push("Secure");
  parts.push(`Path=${opts?.path ?? "/"}`);
  if (opts?.maxAge && Number.isFinite(opts.maxAge)) parts.push(`Max-Age=${Math.floor(opts.maxAge)}`);
  parts.push(`SameSite=${opts?.sameSite ?? "Lax"}`);
  if (opts?.domain) parts.push(`Domain=${opts.domain}`);
  return parts.join("; ");
}

async function setRefreshCookie(c: Context, tenantId: string, accessToken: string) {
  // Derive payload from access token to keep claims consistent
  // Avoid forwarding standard claims (exp/iat) to jsonwebtoken when using expiresIn
  const decoded = verifyToken(accessToken);
  const payload: JwtPayload = {
    sub: String(decoded.sub),
    email: decoded.email,
    role: decoded.role,
  };
  const refreshToken = signRefreshToken(payload);
  const key = `refresh:${tenantId}:${payload.sub}`;
  await kvSet(key, refreshToken, { EX: REFRESH_TTL_SECONDS });
  const forwardedProto = c.req.header("x-forwarded-proto") || "";
  const isHttps = forwardedProto.toLowerCase() === "https" || c.req.url.startsWith("https://");
  const secureFlag = REFRESH_COOKIE_SECURE || isHttps;
  const cookie = buildSetCookie(REFRESH_COOKIE_NAME, refreshToken, {
    httpOnly: true,
    secure: secureFlag,
    path: REFRESH_COOKIE_PATH,
    maxAge: REFRESH_TTL_SECONDS,
    sameSite: secureFlag ? "None" : "Lax",
  });
  // Ensure cookies are forwarded via gateway
  c.header("Set-Cookie", cookie);
}

function clearRefreshCookie(c: Context) {
  const parts = [`${REFRESH_COOKIE_NAME}=`, "HttpOnly", REFRESH_COOKIE_SECURE ? "Secure" : undefined, `Path=${REFRESH_COOKIE_PATH}`, "Max-Age=0", `SameSite=${REFRESH_COOKIE_SECURE ? "None" : "Lax"}`]
    .filter(Boolean) as string[];
  c.header("Set-Cookie", parts.join("; "));
}

function clearAuthTokenCookie(c: Context) {
  // Frontend tarafından ayarlanan auth_token çerezini temizle
  const secure = (process.env.NODE_ENV === 'production');
  const parts = [`auth_token=`, "HttpOnly", secure ? "Secure" : undefined, `Path=/`, "Max-Age=0", `SameSite=Lax`]
    .filter(Boolean) as string[];
  c.header("Set-Cookie", parts.join("; "));
}

function clearAllAuthCookies(c: Context) {
  // Hem refresh_token hem de auth_token çerezlerini temizle
  const forwardedProto = c.req.header("x-forwarded-proto") || "";
  const isHttps = forwardedProto.toLowerCase() === "https" || c.req.url.startsWith("https://");
  const secure = (process.env.NODE_ENV === 'production') || isHttps;
  
  // refresh_token çerezini temizle
  const refreshParts = [`${REFRESH_COOKIE_NAME}=`, "HttpOnly", secure ? "Secure" : undefined, `Path=${REFRESH_COOKIE_PATH}`, "Max-Age=0", `SameSite=${secure ? "None" : "Lax"}`]
    .filter(Boolean) as string[];
  
  // auth_token çerezini temizle
  const authParts = [`auth_token=`, "HttpOnly", secure ? "Secure" : undefined, `Path=/`, "Max-Age=0", `SameSite=Lax`]
    .filter(Boolean) as string[];
  
  // Birden fazla Set-Cookie header'ını append ile ekle
  c.header("Set-Cookie", refreshParts.join("; "), { append: true });
  c.header("Set-Cookie", authParts.join("; "), { append: true });
}

export class AuthController {
  async health(c: Context) {
    return c.json({ ok: true });
  }

  async register(c: Context) {
    try {
      const body = await c.req.json();
      const parsed = RegisterSchema.safeParse(body);

      if (!parsed.success) {
        return c.json(jsonErr("Invalid input", "VALIDATION_ERROR"), 400);
      }

      const tenantId = resolveTenantId(c.req.header());

      const result = await authService.register(parsed.data, tenantId);
      
      return c.json(jsonOk(result), 201);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Registration failed";

      // Duplicate email -> 409 Conflict (explicit friendly message)
      if (
        message === "EMAIL_ALREADY_REGISTERED" ||
        /duplicate key value/i.test(String(message)) ||
        /violates unique constraint/i.test(String(message)) ||
        /unique constraint/i.test(String(message))
      ) {
        return c.json(jsonErr("Duplicate email (already registered)", "CONFLICT"), 409);
      }

      // For other errors, return 500 Internal Server Error
      return c.json(jsonErr(message), 500);
    }
  }

  async login(c: Context) {
    try {
      const body = await c.req.json();
      const parsed = LoginSchema.safeParse(body);

      if (!parsed.success) {
        return c.json(jsonErr("Invalid input", "VALIDATION_ERROR"), 400);
      }

      const tenantId = resolveTenantId(c.req.header());

      const result = await authService.login(parsed.data, tenantId);

      await setRefreshCookie(c, tenantId, result.accessToken);

      return c.json(jsonOk(result));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Login failed";
      if (message === "INVALID_CREDENTIALS") {
        return c.json(jsonErr("Invalid email or password", "INVALID_CREDENTIALS"), 401);
      }
      return c.json(jsonErr(message), 500);
    }
  }

  async refresh(c: Context) {
    try {
      const body = await c.req.json().catch(() => ({} as any));
      let refreshToken: string | undefined = body?.refreshToken;
      if (!refreshToken || typeof refreshToken !== "string") {
        const cookieHeader = c.req.header("cookie") || c.req.header("Cookie") || "";
        try {
          const parts = cookieHeader.split(";").map((p) => p.trim());
          for (const p of parts) {
            if (p.startsWith(`${REFRESH_COOKIE_NAME}=`)) {
              const v = decodeURIComponent(p.substring(REFRESH_COOKIE_NAME.length + 1));
              if (v) refreshToken = v;
              break;
            }
          }
        } catch {}
      }
      if (!refreshToken || typeof refreshToken !== "string") {
        return c.json(jsonErr("refreshToken is required"), 400);
      }

      const tenantId = resolveTenantId(c.req.header());

      const result = await authService.refresh(refreshToken, tenantId);

      await setRefreshCookie(c, tenantId, result.accessToken);

      return c.json(jsonOk(result));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Refresh failed";
      if (message === "INVALID_REFRESH_TOKEN") {
        return c.json(jsonErr("Invalid or expired refresh token", "INVALID_REFRESH_TOKEN"), 401);
      }
      return c.json(jsonErr(message), 500);
    }
  }

  async loginByPhone(c: Context) {
    try {
      const body = await c.req.json();
      const parsed = LoginByPhoneSchema.safeParse(body);

      if (!parsed.success) {
        return c.json(jsonErr("Invalid input", "VALIDATION_ERROR"), 400);
      }

      const tenantId = resolveTenantId(c.req.header());

      const result = await authService.loginByPhone(parsed.data.phone, tenantId);

      await setRefreshCookie(c, tenantId, result.accessToken);

      return c.json(jsonOk(result));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Phone login failed";
      if (message === "USER_NOT_FOUND") {
        return c.json(jsonErr("User not found", "USER_NOT_FOUND"), 404);
      }
      if (message === "PHONE_NOT_VERIFIED") {
        return c.json(jsonErr("Phone not verified", "PHONE_NOT_VERIFIED"), 403);
      }
      return c.json(jsonErr(message), 500);
    }
  }

  async startPhoneVerify(c: Context) {
    try {
      const body = await c.req.json();
      const parsed = PhoneStartSchema.safeParse(body);

      if (!parsed.success) {
        return c.json(jsonErr("Invalid input", "VALIDATION_ERROR"), 400);
      }

      const tenantId = resolveTenantId(c.req.header());

      await authService.startPhoneVerify(parsed.data.phone, tenantId, parsed.data.userName);

      return c.json(jsonOk({ message: "Verification code sent" }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to start phone verification";
      return c.json(jsonErr(message), 500);
    }
  }

  async verifyPhone(c: Context) {
    try {
      const body = await c.req.json();
      const parsed = PhoneVerifySchema.safeParse(body);

      if (!parsed.success) {
        return c.json(jsonErr("Invalid input", "VALIDATION_ERROR"), 400);
      }

      const tenantId = resolveTenantId(c.req.header());

      await authService.verifyPhone(parsed.data.phone, parsed.data.code, tenantId);

      return c.json(jsonOk({ message: "Phone verified" }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Phone verification failed";
      if (message === "INVALID_VERIFICATION_CODE") {
        return c.json(jsonErr("Invalid verification code", "INVALID_VERIFICATION_CODE"), 400);
      }
      return c.json(jsonErr(message), 500);
    }
  }

  async verifyAndSetPhone(c: Context) {
    try {
      const body = await c.req.json();
      const parsed = PhoneVerifySchema.safeParse(body);

      if (!parsed.success) {
        return c.json(jsonErr("Invalid input", "VALIDATION_ERROR"), 400);
      }

      const tenantId = resolveTenantId(c.req.header());

      // Extract user from auth middleware
      const userId = c.get("userId") as string | undefined;
      if (!userId) {
        return c.json(jsonErr("Unauthorized", "UNAUTHORIZED"), 401);
      }

      await authService.verifyAndSetPhone(parsed.data.phone, parsed.data.code, userId, tenantId);

      return c.json(jsonOk({ message: "Phone verified and set" }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Phone verification failed";
      if (message === "INVALID_VERIFICATION_CODE") {
        return c.json(jsonErr("Invalid verification code", "INVALID_VERIFICATION_CODE"), 400);
      }
      return c.json(jsonErr(message), 500);
    }
  }

  async getUserById(c: Context) {
    try {
      const { id } = c.req.param();
      const tenantId = resolveTenantId(c.req.header());
      const user = await authService.getUserById(id, tenantId);

      if (!user) {
        return c.json(jsonErr("User not found", "NOT_FOUND"), 404);
      }

      return c.json(jsonOk(user));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to get user";
      return c.json(jsonErr(message), 500);
    }
  }

  async verifyEmail(c: Context) {
    try {
      const body = await c.req.json();
      const parsed = VerifyEmailSchema.safeParse(body);

      if (!parsed.success) {
        return c.json(jsonErr("Invalid input", "VALIDATION_ERROR"), 400);
      }

      const tenantId = resolveTenantId(c.req.header());

      await authService.verifyEmail(parsed.data.email, parsed.data.code, tenantId);

      return c.json(jsonOk({ message: "Email verified" }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Email verification failed";
      if (message === "INVALID_VERIFICATION_CODE") {
        return c.json(jsonErr("Invalid verification code", "INVALID_VERIFICATION_CODE"), 400);
      }
      return c.json(jsonErr(message), 500);
    }
  }

  async resendVerification(c: Context) {
    try {
      const body = await c.req.json();
      const parsed = ResendEmailSchema.safeParse(body);

      if (!parsed.success) {
        return c.json(jsonErr("Invalid input", "VALIDATION_ERROR"), 400);
      }

      const tenantId = resolveTenantId(c.req.header());

      await authService.resendEmailVerification(parsed.data.email, tenantId);

      return c.json(jsonOk({ message: "Verification email sent" }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to resend verification";
      if (message === "USER_NOT_FOUND") {
        return c.json(jsonErr("User not found", "USER_NOT_FOUND"), 404);
      }
      if (message === "EMAIL_ALREADY_VERIFIED") {
        return c.json(jsonErr("Email already verified", "EMAIL_ALREADY_VERIFIED"), 400);
      }
      return c.json(jsonErr(message), 500);
    }
  }

  async startEmailPasswordReset(c: Context) {
    try {
      const body = await c.req.json();
      const parsed = EmailPasswordResetStartSchema.safeParse(body);

      if (!parsed.success) {
        return c.json(jsonErr("Invalid input", "VALIDATION_ERROR"), 400);
      }

      const tenantId = resolveTenantId(c.req.header());

      await authService.startEmailPasswordReset(parsed.data.email, tenantId);

      return c.json(jsonOk({ message: "Password reset email sent" }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to start password reset";
      return c.json(jsonErr(message), 500);
    }
  }

  async verifyEmailPasswordReset(c: Context) {
    try {
      const body = await c.req.json();
      const parsed = VerifyEmailPasswordResetSchema.safeParse(body);

      if (!parsed.success) {
        return c.json(jsonErr("Invalid input", "VALIDATION_ERROR"), 400);
      }

      const tenantId = resolveTenantId(c.req.header());

      await authService.verifyEmailPasswordReset(parsed.data.email, parsed.data.code, tenantId);

      return c.json(jsonOk({ message: "Reset code verified" }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Verification failed";
      if (message === "INVALID_RESET_CODE") {
        return c.json(jsonErr("Invalid reset code", "INVALID_RESET_CODE"), 400);
      }
      return c.json(jsonErr(message), 500);
    }
  }

  async resetPasswordByEmail(c: Context) {
    try {
      const body = await c.req.json();
      const parsed = ResetPasswordByEmailSchema.safeParse(body);

      if (!parsed.success) {
        return c.json(jsonErr("Invalid input", "VALIDATION_ERROR"), 400);
      }

      const tenantId = resolveTenantId(c.req.header());

      await authService.resetPasswordByEmail(
        parsed.data.email,
        parsed.data.code,
        parsed.data.newPassword,
        tenantId
      );

      return c.json(jsonOk({ message: "Password reset successful" }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Password reset failed";
      if (message === "INVALID_RESET_CODE") {
        return c.json(jsonErr("Invalid reset code", "INVALID_RESET_CODE"), 400);
      }
      return c.json(jsonErr(message), 500);
    }
  }

  async startPhonePasswordReset(c: Context) {
    try {
      const body = await c.req.json();
      const parsed = PhonePasswordResetStartSchema.safeParse(body);

      if (!parsed.success) {
        return c.json(jsonErr("Invalid input", "VALIDATION_ERROR"), 400);
      }

      const tenantId = resolveTenantId(c.req.header());

      await authService.startPhonePasswordReset(parsed.data.phone, tenantId);

      return c.json(jsonOk({ message: "Password reset SMS sent" }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to start password reset";
      return c.json(jsonErr(message), 500);
    }
  }

  async verifyPhonePasswordReset(c: Context) {
    try {
      const body = await c.req.json();
      const parsed = VerifyPhonePasswordResetSchema.safeParse(body);

      if (!parsed.success) {
        return c.json(jsonErr("Invalid input", "VALIDATION_ERROR"), 400);
      }

      const tenantId = resolveTenantId(c.req.header());

      await authService.verifyPhonePasswordReset(parsed.data.phone, parsed.data.code, tenantId);

      return c.json(jsonOk({ message: "Reset code verified" }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Verification failed";
      if (message === "INVALID_RESET_CODE") {
        return c.json(jsonErr("Invalid reset code", "INVALID_RESET_CODE"), 400);
      }
      return c.json(jsonErr(message), 500);
    }
  }

  async resetPasswordByPhone(c: Context) {
    try {
      const body = await c.req.json();
      const parsed = ResetPasswordByPhoneSchema.safeParse(body);

      if (!parsed.success) {
        return c.json(jsonErr("Invalid input", "VALIDATION_ERROR"), 400);
      }

      const tenantId = resolveTenantId(c.req.header());

      await authService.resetPasswordByPhone(
        parsed.data.phone,
        parsed.data.code,
        parsed.data.newPassword,
        tenantId
      );

      return c.json(jsonOk({ message: "Password reset successful" }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Password reset failed";
      if (message === "INVALID_RESET_CODE") {
        return c.json(jsonErr("Invalid reset code", "INVALID_RESET_CODE"), 400);
      }
      return c.json(jsonErr(message), 500);
    }
  }

  async validateToken(c: Context) {
    try {
      const body = await c.req.json();
      const { token } = body;
      if (!token || typeof token !== "string") {
        return c.json(jsonErr("token is required"), 400);
      }

      const payload = await authService.validateToken(token);

      return c.json(jsonOk({ valid: true, payload }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Token validation failed";
      if (message === "INVALID_TOKEN") {
        return c.json(jsonOk({ valid: false, error: "Invalid token" }));
      }
      return c.json(jsonErr(message), 500);
    }
  }

  async me(c: Context) {
    try {
      const userId = c.get("userId");
      if (!userId) {
        return c.json(jsonErr("Unauthorized", "UNAUTHORIZED"), 401);
      }

      const tenantId = resolveTenantId(c.req.header());

      const user = await authService.getUserById(userId, tenantId);

      if (!user) {
        return c.json(jsonErr("User not found", "NOT_FOUND"), 404);
      }

      return c.json(jsonOk(user));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to get current user";
      return c.json(jsonErr(message), 500);
    }
  }

  async logout(c: Context) {
    try {
      const userId = c.get("userId");
      const tenantId = resolveTenantId(c.req.header());

      // Kullanıcı kimliği yoksa bile çerezleri temizle (best-effort logout)
      if (userId) {
        await authService.logout(userId, tenantId);
      }
      clearAllAuthCookies(c);

      return c.json(jsonOk({ message: "Logged out" }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Logout failed";
      return c.json(jsonErr(message), 500);
    }
  }
}