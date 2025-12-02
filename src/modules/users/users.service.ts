import { db } from "../../db";
import { users } from "../../db/schema";
import { eq } from "drizzle-orm";
import { localAuthClient, type AuthUser } from "../../core/clients/local-auth.client";
import { env } from "../../core/env";

export interface UserProfile {
  id: string;
  gender?: "male" | "female" | "other";
  profileImageUrl?: string;
  dateOfBirth?: Date;
  bio?: string;
  address?: string;
  city?: string;
  country?: string;
  preferences?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserData {
  id: string;
  gender?: "male" | "female" | "other";
  profileImageUrl?: string;
  dateOfBirth?: Date;
  bio?: string;
  address?: string;
  city?: string;
  country?: string;
  preferences?: Record<string, unknown>;
}

export interface UpdateUserData {
  gender?: "male" | "female" | "other";
  profileImageUrl?: string;
  dateOfBirth?: Date;
  bio?: string;
  address?: string;
  city?: string;
  country?: string;
  preferences?: Record<string, unknown>;
}

export interface CompleteUserProfile {
  // Auth servisinden gelen bilgiler (frontend beklentisine uygun nested yapı)
  auth: {
    id: string;
    email: string;
    name?: string;
    phone?: string;
    role: string;
    emailVerified?: boolean;
  };
  // Backend servisinden gelen profil bilgileri
  profile?: UserProfile;
}

export class UsersService {
  /**
   * Auth kullanıcı ID'sine göre kullanıcının tam profilini getirir
   * Auth servisinden temel bilgileri, Backend servisinden profil bilgilerini alır
   */
  async getUserByAuthId(
    userId: string
  ): Promise<CompleteUserProfile | null> {
    try {
      // Auth servisinden kullanıcı bilgilerini al
      const authResult = await localAuthClient.getUserById(userId);

      if (!authResult.success || !authResult.data) {
        console.error("Auth service error:", authResult.error);
        return null;
      }

      const authUser = authResult.data;

      // Backend servisinden profil bilgilerini al
      const profileResult = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      const profile = profileResult.length > 0 ? profileResult[0] : undefined;

      // Güvenli şekilde name üret (Auth servisinde name yoksa firstName + lastName kullan)
      const computedName =
        [authUser.firstName, authUser.lastName]
          .filter(Boolean)
          .join(" ")
          .trim() || undefined;

      return {
        auth: {
          id: authUser.id,
          email: authUser.email,
          name: computedName,
          phone: authUser.phone,
          role: authUser.role,
          emailVerified: authUser.isEmailVerified,
        },
        profile: profile
          ? {
              id: profile.id,
              gender: profile.gender || undefined,
              profileImageUrl: profile.profileImageUrl || undefined,
              dateOfBirth: profile.dateOfBirth || undefined,
              bio: profile.bio || undefined,
              address: profile.address || undefined,
              city: profile.city || undefined,
              country: profile.country || undefined,
              preferences: profile.preferences
                ? (profile.preferences as Record<string, unknown>)
                : undefined,
              createdAt: profile.createdAt,
              updatedAt: profile.updatedAt,
            }
          : undefined,
      };
    } catch (error) {
      console.error("Error getting user by auth ID:", error);
      return null;
    }
  }

  /**
   * Yeni kullanıcı profili oluşturur
   */
  async createUserProfile(data: CreateUserData): Promise<UserProfile | null> {
    try {
      // Kullanıcı zaten var mı kontrol et
      const existingUser = await db
        .select()
        .from(users)
        .where(eq(users.id, data.id))
        .limit(1);

      if (existingUser.length > 0) {
        throw new Error("User already exists");
      }

      const newUser = await db
        .insert(users)
        .values({
          ...data,
          // Multi-tenant: zorunlu tenantId alanını doldur
          tenantId: env.TENANT_ID,
        })
        .returning();

      return newUser[0]
        ? {
            id: newUser[0].id,
            gender: newUser[0].gender || undefined,
            profileImageUrl: newUser[0].profileImageUrl || undefined,
            dateOfBirth: newUser[0].dateOfBirth || undefined,
            bio: newUser[0].bio || undefined,
            address: newUser[0].address || undefined,
            city: newUser[0].city || undefined,
            country: newUser[0].country || undefined,
            preferences: newUser[0].preferences
              ? (newUser[0].preferences as Record<string, unknown>)
              : undefined,
            createdAt: newUser[0].createdAt,
            updatedAt: newUser[0].updatedAt,
          }
        : null;
    } catch (error) {
      console.error("Error creating user profile:", error);
      return null;
    }
  }

  /**
   * Kullanıcı profilini günceller
   */
  async updateUserProfile(
    authUserId: string,
    data: UpdateUserData
  ): Promise<UserProfile | null> {
    try {
      const updatedUser = await db
        .update(users)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(eq(users.id, authUserId))
        .returning();

      return updatedUser[0]
        ? {
            id: updatedUser[0].id,
            gender: updatedUser[0].gender || undefined,
            profileImageUrl: updatedUser[0].profileImageUrl || undefined,
            dateOfBirth: updatedUser[0].dateOfBirth || undefined,
            bio: updatedUser[0].bio || undefined,
            address: updatedUser[0].address || undefined,
            city: updatedUser[0].city || undefined,
            country: updatedUser[0].country || undefined,
            preferences: updatedUser[0].preferences
              ? (updatedUser[0].preferences as Record<string, unknown>)
              : undefined,
            createdAt: updatedUser[0].createdAt,
            updatedAt: updatedUser[0].updatedAt,
          }
        : null;
    } catch (error) {
      console.error("Error updating user profile:", error);
      return null;
    }
  }

  /**
   * Kullanıcı profilini ID ile günceller (frontend PUT /users/:id beklentisine uygun)
   */
  async updateUserProfileById(
    id: string,
    data: UpdateUserData
  ): Promise<UserProfile | null> {
    try {
      const updatedUser = await db
        .update(users)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(eq(users.id, id))
        .returning();

      return updatedUser[0]
        ? {
            id: updatedUser[0].id,
            gender: updatedUser[0].gender || undefined,
            profileImageUrl: updatedUser[0].profileImageUrl || undefined,
            dateOfBirth: updatedUser[0].dateOfBirth || undefined,
            bio: updatedUser[0].bio || undefined,
            address: updatedUser[0].address || undefined,
            city: updatedUser[0].city || undefined,
            country: updatedUser[0].country || undefined,
            preferences: updatedUser[0].preferences
              ? (updatedUser[0].preferences as Record<string, unknown>)
              : undefined,
            createdAt: updatedUser[0].createdAt,
            updatedAt: updatedUser[0].updatedAt,
          }
        : null;
    } catch (error) {
      console.error("Error updating user profile by id:", error);
      return null;
    }
  }

  /**
   * Kullanıcı profilini siler
   */
  async deleteUserProfile(authUserId: string): Promise<boolean> {
    try {
      const deletedUser = await db
        .delete(users)
        .where(eq(users.id, authUserId))
        .returning();

      return deletedUser.length > 0;
    } catch (error) {
      console.error("Error deleting user profile:", error);
      return false;
    }
  }

  /**
   * Kullanıcı profilini ID ile siler (frontend DELETE /users/:id beklentisine uygun)
   */
  async deleteUserProfileById(id: string): Promise<boolean> {
    try {
      const deletedUser = await db
        .delete(users)
        .where(eq(users.id, id))
        .returning();
      return deletedUser.length > 0;
    } catch (error) {
      console.error("Error deleting user profile by id:", error);
      return false;
    }
  }

  /**
   * Token'ı doğrular ve kullanıcı bilgilerini döner
   */
  async validateUserToken(token: string): Promise<AuthUser | null> {
    try {
      const result = await localAuthClient.validateToken(token);

      if (!result.success || !result.data) {
        console.error("Token validation failed:", result.error);
        return null;
      }

      return result.data;
    } catch (error) {
      console.error("Error validating token:", error);
      return null;
    }
  }
}

// Singleton instance
export const usersService = new UsersService();