import jwt from 'jsonwebtoken';
import type { JwtPayload } from '../auth.dto';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

// Default expirations (configurable)
// Use numeric seconds to avoid type issues with jsonwebtoken SignOptions.expiresIn
export const ACCESS_TOKEN_EXPIRES_IN_SECONDS = Number(process.env.ACCESS_TOKEN_EXPIRES_IN_SECONDS ?? 15 * 60); // 15 minutes
export const REFRESH_TOKEN_EXPIRES_IN_SECONDS = Number(process.env.REFRESH_TOKEN_EXPIRES_IN_SECONDS ?? 7 * 24 * 60 * 60); // 7 days
export const REFRESH_TTL_SECONDS = Number(process.env.REFRESH_TTL_SECONDS || 7 * 24 * 60 * 60);

// Sign a token, ensuring we don't pass conflicting standard claims.
// jsonwebtoken throws when both payload.exp and options.expiresIn are present.
// We proactively strip exp/iat from payload to avoid this conflict and always
// control expiration via SignOptions.expiresIn.
export function signToken(
  payload: JwtPayload,
  opts: jwt.SignOptions = { expiresIn: ACCESS_TOKEN_EXPIRES_IN_SECONDS }
) {
  const { exp: _exp, iat: _iat, ...rest } = (payload as unknown as Record<string, unknown>);
  return jwt.sign(rest as JwtPayload, JWT_SECRET, opts);
}

export function verifyToken(token: string): JwtPayload {
  // NOTE: jwt.verify will throw if token is invalid/expired. We let callers handle this.
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}

// Convenience helpers
export function signAccessToken(payload: JwtPayload) {
  return signToken(payload, { expiresIn: ACCESS_TOKEN_EXPIRES_IN_SECONDS });
}

export function signRefreshToken(payload: JwtPayload) {
  return signToken(payload, { expiresIn: REFRESH_TOKEN_EXPIRES_IN_SECONDS });
}