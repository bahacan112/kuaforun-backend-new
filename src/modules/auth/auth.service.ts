import bcrypt from "bcryptjs";
import { db } from "../../db";
import { users } from "../../db/schema";
import { eq, and } from "drizzle-orm";
import type { RegisterRequest, LoginRequest } from "./auth.dto";
import { signAccessToken, signRefreshToken, verifyToken } from "./utils/jwt.util";
import { kvSet, kvGet, kvDel } from "./utils/kv.util";
import type { JwtPayload } from "./auth.dto";
import { NotificationsService } from "../notifications/notifications.service";
import { env } from "../../core/env";

export class AuthService {
  private notificationsService: NotificationsService;

  constructor() {
    this.notificationsService = new NotificationsService();
  }
  /**
   * Register a new user
   */
  async register(data: RegisterRequest, tenantId: string) {
    const { email, password, name, phone, gender, role } = data;
    
    console.log('=== REGISTER DEBUG INFO ===');
    console.log('Attempting to register user:', { email, name, tenantId });
    console.log('Database connection pool initialized');
    
    // Check if user already exists
    let existingUser;
    try {
      console.log('Checking existing user with query...');
      existingUser = await db
        .select()
        .from(users)
        .where(and(eq(users.email, email), eq(users.tenantId, tenantId)))
        .limit(1);
      console.log('Existing user check result:', existingUser.length > 0 ? 'User exists' : 'User does not exist');
    } catch (error) {
      console.error('Database query error in register - existing user check:', error);
      console.error('Error details:', error instanceof Error ? { message: error.message, stack: error.stack } : error);
      throw new Error(`Failed query: ${error instanceof Error ? error.message : String(error)}`);
    }

    if (existingUser.length > 0) {
      throw new Error("EMAIL_ALREADY_REGISTERED");
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    let newUser;
    try {
      [newUser] = await db
        .insert(users)
        .values({
          email,
          passwordHash,
          name,
          tenantId,
          role: role || "customer",
          phone,
          gender,
        })
        .returning();
    } catch (error) {
      console.error('Database query error in register - user creation:', error);
      throw new Error(`Failed to create user: ${error instanceof Error ? error.message : String(error)}`);
    }

    console.log('User created successfully, generating tokens...');
    
    // Generate tokens - use only the UUID id field
    const payload: JwtPayload = {
      sub: newUser.id.toString(),
      email: newUser.email!,
      role: newUser.role,
    };

    console.log('Signing access token...');
    const accessToken = signAccessToken(payload);
    console.log('Signing refresh token...');
    const refreshToken = signRefreshToken(payload);

    console.log('Storing refresh token in Redis...');
    try {
      await kvSet(`refresh:${tenantId}:${newUser.id}`, refreshToken, { EX: 7 * 24 * 60 * 60 });
      console.log('Refresh token stored successfully');
    } catch (redisError) {
      console.error('Redis error storing refresh token:', redisError);
      // Continue without Redis - don't fail registration if Redis is down
      console.log('Continuing without Redis storage...');
    }

    console.log('Registration completed successfully');
    
    // Send email verification after successful registration
    if (newUser.email && !newUser.emailVerifiedAt) {
      try {
        console.log('Sending email verification after registration...');
        await this.resendEmailVerification(newUser.email, tenantId);
        console.log('Email verification sent successfully after registration');
      } catch (error) {
        console.error('Failed to send email verification after registration:', error);
        // Don't fail registration if email verification fails
      }
    }
    
    return {
      id: newUser.id,
      email: newUser.email,
      name: newUser.name,
      role: newUser.role,
      accessToken,
      refreshToken,
    };
  }

  /**
   * Login with email and password
   */
  async login(data: LoginRequest, tenantId: string) {
    const { email, password } = data;

    // Find user
    const [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.email, email), eq(users.tenantId, tenantId)))
      .limit(1);

    if (!user) {
      throw new Error("INVALID_CREDENTIALS");
    }

    // Verify password
    if (!user.passwordHash) {
      throw new Error("INVALID_CREDENTIALS");
    }
    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      throw new Error("INVALID_CREDENTIALS");
    }

    // Generate tokens - use only the UUID id field
    const payload: JwtPayload = {
      sub: user.id.toString(),
      email: user.email!,
      role: user.role,
    };

    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    // Store refresh token
    await kvSet(`refresh:${tenantId}:${user.id}`, refreshToken, { EX: 7 * 24 * 60 * 60 });

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      accessToken,
      refreshToken,
    };
  }

  /**
   * Get user by ID
   */
  async getUserById(id: string, tenantId: string) {
    const [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, id), eq(users.tenantId, tenantId)))
      .limit(1);

    if (!user) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      phone: user.phone,
      gender: user.gender,
      emailVerifiedAt: user.emailVerifiedAt,
      phoneVerifiedAt: user.phoneVerifiedAt,
      registrationApprovedAt: user.registrationApprovedAt,
    };
  }

  /**
   * Verify email with code
   */
  async verifyEmail(email: string, code: string, tenantId: string) {
    const verificationCode = await kvGet(`email-verify:${tenantId}:${email}`);
    
    if (!verificationCode || verificationCode !== code) {
      throw new Error("INVALID_VERIFICATION_CODE");
    }

    // Update user
    await db
      .update(users)
      .set({ emailVerifiedAt: new Date() })
      .where(and(eq(users.email, email), eq(users.tenantId, tenantId)));

    // Delete verification code
    await kvDel(`email-verify:${tenantId}:${email}`);

    return true;
  }

  /**
   * Resend email verification
   */
  async resendEmailVerification(email: string, tenantId: string) {
    const [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.email, email), eq(users.tenantId, tenantId)))
      .limit(1);

    if (!user) {
      throw new Error("USER_NOT_FOUND");
    }

    if (user.emailVerifiedAt) {
      throw new Error("EMAIL_ALREADY_VERIFIED");
    }

    // Generate verification code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Store verification code (15 minutes)
    await kvSet(`email-verify:${tenantId}:${email}`, code, { EX: 15 * 60 });

    // Send email notification
    try {
      await this.notificationsService.send({
        email: {
          to: email,
          subject: 'E-posta Doğrulama Kodu',
          text: `Merhaba ${user.name || ''},\n\nE-posta adresinizi doğrulamak için aşağıdaki kodu kullanın:\n\nDoğrulama Kodu: ${code}\n\nBu kod 15 dakika boyunca geçerlidir.\n\nSaygılarımızla,\nKuaförüm Ekibi`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2>E-posta Doğrulama</h2>
              <p>Merhaba ${user.name || ''},</p>
              <p>E-posta adresinizi doğrulamak için aşağıdaki kodu kullanın:</p>
              <div style="background-color: #f4f4f4; padding: 20px; text-align: center; border-radius: 5px;">
                <h3 style="margin: 0; color: #333;">Doğrulama Kodu</h3>
                <p style="font-size: 24px; font-weight: bold; letter-spacing: 2px; margin: 10px 0;">${code}</p>
              </div>
              <p>Bu kod 15 dakika boyunca geçerlidir.</p>
              <p>Saygılarımızla,<br>Kuaförüm Ekibi</p>
            </div>
          `
        }
      }, tenantId);
      console.log('Email verification sent successfully');
    } catch (error) {
      console.error('Failed to send email verification:', error);
      // Don't fail the verification process if email fails
    }

    return true;
  }

  /**
   * Start phone verification
   */
  async startPhoneVerify(phone: string, tenantId: string, userName?: string) {
    // Generate verification code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Store verification code (15 minutes)
    await kvSet(`phone-verify:${tenantId}:${phone}`, code, { EX: 15 * 60 });

    // Send SMS notification
    try {
      await this.notificationsService.send({
        sms: {
          to: phone,
          text: `Merhaba ${userName || ''},\n\nTelefon numaranızı doğrulamak için kodunuz: ${code}\n\nBu kod 15 dakika boyunca geçerlidir.\n\nKuaförüm Ekibi`
        }
      }, tenantId);
      console.log('SMS verification sent successfully');
    } catch (error) {
      console.error('Failed to send SMS verification:', error);
      // Don't fail the verification process if SMS fails
    }

    return true;
  }

  /**
   * Verify phone
   */
  async verifyPhone(phone: string, code: string, tenantId: string) {
    const devBypass = env.NODE_ENV === "development" && code === "000000";
    const verificationCode = devBypass
      ? code
      : await kvGet(`phone-verify:${tenantId}:${phone}`);
    if (!devBypass && (!verificationCode || verificationCode !== code)) {
      throw new Error("INVALID_VERIFICATION_CODE");
    }

    // Update user
    await db
      .update(users)
      .set({ phoneVerifiedAt: new Date() })
      .where(and(eq(users.phone, phone), eq(users.tenantId, tenantId)));

    // Delete verification code
    if (!devBypass) {
      await kvDel(`phone-verify:${tenantId}:${phone}`);
    }

    return true;
  }

  /**
   * Login by phone
   */
  async loginByPhone(phone: string, tenantId: string) {
    const [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.phone, phone), eq(users.tenantId, tenantId)))
      .limit(1);

    if (!user) {
      throw new Error("USER_NOT_FOUND");
    }

    if (!user.phoneVerifiedAt) {
      throw new Error("PHONE_NOT_VERIFIED");
    }

    // Generate tokens
    const payload: JwtPayload = {
      sub: user.id.toString(),
      email: user.email!,
      role: user.role,
    };

    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    // Store refresh token
    await kvSet(`refresh:${tenantId}:${user.id}`, refreshToken, { EX: 7 * 24 * 60 * 60 });

    return {
      id: user.id,
      authUserId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      accessToken,
      refreshToken,
    };
  }

  /**
   * Verify and set phone
   */
  async verifyAndSetPhone(phone: string, code: string, userId: string, tenantId: string) {
    const devBypass = env.NODE_ENV === "development" && code === "000000";
    const verificationCode = devBypass
      ? code
      : await kvGet(`phone-verify:${tenantId}:${phone}`);
    if (!devBypass && (!verificationCode || verificationCode !== code)) {
      throw new Error("INVALID_VERIFICATION_CODE");
    }

    // Update user
    await db
      .update(users)
      .set({ 
        phone,
        phoneVerifiedAt: new Date() 
      })
      .where(and(eq(users.id, userId), eq(users.tenantId, tenantId)));

    // Delete verification code
    if (!devBypass) {
      await kvDel(`phone-verify:${tenantId}:${phone}`);
    }

    return true;
  }

  /**
   * Start email password reset
   */
  async startEmailPasswordReset(email: string, tenantId: string) {
    const [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.email, email), eq(users.tenantId, tenantId)))
      .limit(1);

    if (!user) {
      // Don't reveal if user exists
      return true;
    }

    // Generate reset code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Store reset code (15 minutes)
    await kvSet(`password-reset:${tenantId}:${email}`, code, { EX: 15 * 60 });

    // Send password reset email
    try {
      await this.notificationsService.send({
        email: {
          to: email,
          subject: 'Şifre Yenileme Kodu',
          text: `Merhaba,\n\nŞifrenizi yenilemek için aşağıdaki kodu kullanın:\n\nŞifre Yenileme Kodu: ${code}\n\nBu kod 15 dakika boyunca geçerlidir.\n\nEğer siz bu isteği yapmadıysanız, lütfen bu e-postayı dikkate almayın.\n\nSaygılarımızla,\nKuaförüm Ekibi`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2>Şifre Yenileme</h2>
              <p>Merhaba,</p>
              <p>Şifrenizi yenilemek için aşağıdaki kodu kullanın:</p>
              <div style="background-color: #f4f4f4; padding: 20px; text-align: center; border-radius: 5px;">
                <h3 style="margin: 0; color: #333;">Şifre Yenileme Kodu</h3>
                <p style="font-size: 24px; font-weight: bold; letter-spacing: 2px; margin: 10px 0;">${code}</p>
              </div>
              <p>Bu kod 15 dakika boyunca geçerlidir.</p>
              <p>Eğer siz bu isteği yapmadıysanız, lütfen bu e-postayı dikkate almayın.</p>
              <p>Saygılarımızla,<br>Kuaförüm Ekibi</p>
            </div>
          `
        }
      }, tenantId);
      console.log('Password reset email sent successfully');
    } catch (error) {
      console.error('Failed to send password reset email:', error);
      // Don't fail the reset process if email fails
    }

    return true;
  }

  /**
   * Verify email password reset
   */
  async verifyEmailPasswordReset(email: string, code: string, tenantId: string) {
    const resetCode = await kvGet(`password-reset:${tenantId}:${email}`);
    
    if (!resetCode || resetCode !== code) {
      throw new Error("INVALID_RESET_CODE");
    }

    return true;
  }

  /**
   * Reset password by email
   */
  async resetPasswordByEmail(email: string, code: string, newPassword: string, tenantId: string) {
    // Verify reset code
    await this.verifyEmailPasswordReset(email, code, tenantId);

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Update user
    await db
      .update(users)
      .set({ passwordHash })
      .where(and(eq(users.email, email), eq(users.tenantId, tenantId)));

    // Delete reset code
    await kvDel(`password-reset:${tenantId}:${email}`);

    return true;
  }

  /**
   * Start phone password reset
   */
  async startPhonePasswordReset(phone: string, tenantId: string) {
    const [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.phone, phone), eq(users.tenantId, tenantId)))
      .limit(1);

    if (!user) {
      // Don't reveal if user exists
      return true;
    }

    // Generate reset code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Store reset code (15 minutes)
    await kvSet(`password-reset:${tenantId}:${phone}`, code, { EX: 15 * 60 });

    // TODO: Send SMS notification
    // await sendPasswordResetSMS(phone, code);

    return true;
  }

  /**
   * Verify phone password reset
   */
  async verifyPhonePasswordReset(phone: string, code: string, tenantId: string) {
    const resetCode = await kvGet(`password-reset:${tenantId}:${phone}`);
    
    if (!resetCode || resetCode !== code) {
      throw new Error("INVALID_RESET_CODE");
    }

    return true;
  }

  /**
   * Reset password by phone
   */
  async resetPasswordByPhone(phone: string, code: string, newPassword: string, tenantId: string) {
    // Verify reset code
    await this.verifyPhonePasswordReset(phone, code, tenantId);

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Update user
    await db
      .update(users)
      .set({ passwordHash })
      .where(and(eq(users.phone, phone), eq(users.tenantId, tenantId)));

    // Delete reset code
    await kvDel(`password-reset:${tenantId}:${phone}`);

    return true;
  }

  /**
   * Validate token
   */
  async validateToken(token: string) {
    try {
      const payload = verifyToken(token);
      return payload;
    } catch {
      throw new Error("INVALID_TOKEN");
    }
  }

  /**
   * Refresh token
   */
  async refresh(refreshToken: string, tenantId: string) {
    try {
      // Verify refresh token
      const payload = verifyToken(refreshToken);
      
      // Check if refresh token exists in Redis
      const storedToken = await kvGet(`refresh:${tenantId}:${payload.sub}`);
      
      if (!storedToken || storedToken !== refreshToken) {
        throw new Error("INVALID_REFRESH_TOKEN");
      }

      // Generate new tokens
      const newPayload: JwtPayload = {
        sub: payload.sub,
        email: payload.email,
        role: payload.role,
      };

      const newAccessToken = signAccessToken(newPayload);
      const newRefreshToken = signRefreshToken(newPayload);

      // Update stored refresh token
      await kvSet(`refresh:${tenantId}:${payload.sub}`, newRefreshToken, { EX: 7 * 24 * 60 * 60 });

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      };
    } catch {
      throw new Error("INVALID_REFRESH_TOKEN");
    }
  }

  /**
   * Logout
   */
  async logout(userId: number, tenantId: string) {
    // Remove refresh token from Redis
    await kvDel(`refresh:${tenantId}:${userId}`);
    return true;
  }
}