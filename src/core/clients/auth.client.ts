import { env } from "../env";

export interface AuthUser {
  id: string;
  email: string;
  // Telefon numarası Auth servisinde opsiyonel olabilir
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

export class AuthApiClient {
  private readonly baseUrl: string;

  constructor() {
    // Gateway üzerinden Auth servisine erişim
    this.baseUrl = env.GATEWAY_URL || "http://localhost:3000";
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<AuthApiResponse<T>> {
    const url = `${this.baseUrl}/auth${endpoint}`;
    
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-Id': env.TENANT_ID || 'kuaforun',
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);
      const data: unknown = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: {
            message: (data as unknown as { error?: { message?: string } })?.error?.message || `HTTP error! status: ${response.status}`,
            code: (data as unknown as { error?: { code?: string } })?.error?.code || 'HTTP_ERROR'
          }
        };
      }

      return data as AuthApiResponse<T>;
    } catch (error) {
      console.error('Auth API request failed:', error);
      return {
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Unknown error occurred',
          code: 'NETWORK_ERROR'
        }
      };
    }
  }

  /**
   * Auth servisinden kullanıcı bilgilerini ID ile getirir
   */
  async getUserById(userId: string): Promise<AuthApiResponse<AuthUser>> {
    return this.makeRequest<AuthUser>(`/users/${userId}`);
  }

  /**
   * Auth servisinden kullanıcı bilgilerini email ile getirir
   */
  async getUserByEmail(email: string): Promise<AuthApiResponse<AuthUser>> {
    return this.makeRequest<AuthUser>(`/users/by-email/${email}`);
  }

  /**
   * Token'ı doğrular ve kullanıcı bilgilerini döner
   */
  async validateToken(token: string): Promise<AuthApiResponse<AuthUser>> {
    return this.makeRequest<AuthUser>('/validate', {
      method: 'POST',
      body: JSON.stringify({ token })
    });
  }

  /**
   * Kullanıcının mevcut olup olmadığını kontrol eder
   */
  async checkUserExists(userId: string): Promise<boolean> {
    const result = await this.getUserById(userId);
    return result.success && !!result.data;
  }
}

// Singleton instance
export const authApiClient = new AuthApiClient();

/**
 * Resolve tenant ID from request headers
 */
export function resolveTenantId(headers: Record<string, string>): string {
  return headers['x-tenant-id'] || env.TENANT_ID || 'main';
}