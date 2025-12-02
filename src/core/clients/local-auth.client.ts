import { db } from "../../db";
import { users } from "../../db/schema";
import { eq } from "drizzle-orm";
import { verifyToken } from "../../modules/auth/utils/jwt.util";

export interface AuthUser {
  id: string;
  email: string;
  phone?: string;
  firstName: string;
  lastName: string;
  role: string;
  tenantId: string;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code?: string;
  };
}

export class LocalAuthClient {
  /**
   * Token'ı doğrular ve kullanıcı bilgilerini döner
   */
  async validateToken(token: string): Promise<AuthApiResponse<AuthUser>> {
    try {
      // JWT token'ı doğrula
      const payload = await verifyToken(token);
      
      if (!payload || !payload.sub) {
        return {
          success: false,
          error: {
            message: "Invalid token payload",
            code: "INVALID_TOKEN"
          }
        };
      }

      // Kullanıcıyı veritabanından bul - artık sadece id alanını kullan
      const user = await db
        .select()
        .from(users)
        .where(eq(users.id, String(payload.sub)))
        .limit(1);

      if (!user || user.length === 0) {
        return {
          success: false,
          error: {
            message: "User not found",
            code: "USER_NOT_FOUND"
          }
        };
      }

      const userData = user[0];
      
      // AuthUser formatına dönüştür
      const authUser: AuthUser = {
        id: userData.id,
        email: userData.email || '',
        phone: userData.phone || undefined,
        firstName: userData.name?.split(' ')[0] || 'User',
        lastName: userData.name?.split(' ').slice(1).join(' ') || '',
        role: userData.role,
        tenantId: userData.tenantId,
        isEmailVerified: !!userData.emailVerifiedAt,
        isPhoneVerified: !!userData.phoneVerifiedAt,
        createdAt: userData.createdAt.toISOString(),
        updatedAt: userData.updatedAt.toISOString()
      };

      return {
        success: true,
        data: authUser
      };
    } catch (error) {
      console.error("Token validation error:", error);
      return {
        success: false,
        error: {
          message: error instanceof Error ? error.message : "Token validation failed",
          code: "VALIDATION_ERROR"
        }
      };
    }
  }

  /**
   * Auth servisinden kullanıcı bilgilerini ID ile getirir
   */
  async getUserById(userId: string): Promise<AuthApiResponse<AuthUser>> {
    try {
      const user = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user || user.length === 0) {
        return {
          success: false,
          error: {
            message: "User not found",
            code: "USER_NOT_FOUND"
          }
        };
      }

      const userData = user[0];
      
      const authUser: AuthUser = {
        id: userData.id,
        email: userData.email || '',
        phone: userData.phone || undefined,
        firstName: userData.name?.split(' ')[0] || '',
        lastName: userData.name?.split(' ').slice(1).join(' ') || '',
        role: userData.role,
        tenantId: userData.tenantId,
        isEmailVerified: !!userData.emailVerifiedAt,
        isPhoneVerified: !!userData.phoneVerifiedAt,
        createdAt: userData.createdAt.toISOString(),
        updatedAt: userData.updatedAt.toISOString()
      };

      return {
        success: true,
        data: authUser
      };
    } catch (error) {
      console.error("Get user by ID error:", error);
      return {
        success: false,
        error: {
          message: error instanceof Error ? error.message : "Failed to get user",
          code: "DATABASE_ERROR"
        }
      };
    }
  }

  /**
   * Auth servisinden kullanıcı bilgilerini email ile getirir
   */
  async getUserByEmail(email: string): Promise<AuthApiResponse<AuthUser>> {
    try {
      const user = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (!user || user.length === 0) {
        return {
          success: false,
          error: {
            message: "User not found",
            code: "USER_NOT_FOUND"
          }
        };
      }

      const userData = user[0];
      
      const authUser: AuthUser = {
        id: userData.id,
        email: userData.email || '',
        phone: userData.phone || undefined,
        firstName: userData.name?.split(' ')[0] || '',
        lastName: userData.name?.split(' ').slice(1).join(' ') || '',
        role: userData.role,
        tenantId: userData.tenantId,
        isEmailVerified: !!userData.emailVerifiedAt,
        isPhoneVerified: !!userData.phoneVerifiedAt,
        createdAt: userData.createdAt.toISOString(),
        updatedAt: userData.updatedAt.toISOString()
      };

      return {
        success: true,
        data: authUser
      };
    } catch (error) {
      console.error("Get user by email error:", error);
      return {
        success: false,
        error: {
          message: error instanceof Error ? error.message : "Failed to get user",
          code: "DATABASE_ERROR"
        }
      };
    }
  }

  /**
   * Kullanıcının mevcut olup olmadığını kontrol eder
   */
  async checkUserExists(userId: string): Promise<boolean> {
    try {
      const user = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      return user.length > 0;
    } catch (error) {
      console.error("Check user exists error:", error);
      return false;
    }
  }
}

// Singleton instance
export const localAuthClient = new LocalAuthClient();