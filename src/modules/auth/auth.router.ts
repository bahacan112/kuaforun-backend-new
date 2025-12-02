import { Hono } from "hono";
import { AuthController } from "./auth.controller";
import { authMiddleware } from "../../core/middleware/auth.middleware";

const authController = new AuthController();

export const authRouter = new Hono()
  // Health check
  .get("/health", authController.health.bind(authController))
  
  // Auth endpoints
  .post("/register", authController.register.bind(authController))
  .post("/login", authController.login.bind(authController))
  .post("/refresh", authController.refresh.bind(authController))
  .post("/login/phone", authController.loginByPhone.bind(authController))
  .post("/phone/start", authController.startPhoneVerify.bind(authController))
  .post("/phone/verify", authController.verifyPhone.bind(authController))
  .post("/phone/verify-and-set", authMiddleware, authController.verifyAndSetPhone.bind(authController))
  .get("/users/:id", authController.getUserById.bind(authController))
  .post("/verify-email", authController.verifyEmail.bind(authController))
  .post("/resend-verification", authController.resendVerification.bind(authController))
  
  // Password reset (email)
  .post("/password-reset/email/start", authController.startEmailPasswordReset.bind(authController))
  .post("/password-reset/email/verify", authController.verifyEmailPasswordReset.bind(authController))
  .post("/password-reset/email/reset", authController.resetPasswordByEmail.bind(authController))
  
  // Password reset (phone)
  .post("/password-reset/phone/start", authController.startPhonePasswordReset.bind(authController))
  .post("/password-reset/phone/verify", authController.verifyPhonePasswordReset.bind(authController))
  .post("/password-reset/phone/reset", authController.resetPasswordByPhone.bind(authController))
  
  .post("/validate", authController.validateToken.bind(authController))
  // Current user endpoint (supports Authorization header or auth_token cookie)
  .get("/me", authMiddleware, authController.me.bind(authController))
  .post("/logout", authMiddleware, authController.logout.bind(authController));