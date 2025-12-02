// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code?: string;
  };
}

export interface ApiError {
  message: string;
  code?: string;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

export function jsonOk<T>(data: T): ApiResponse<T> {
  return { success: true, data };
}

export function jsonErr(message: string, code?: string): ApiResponse<never> {
  return { success: false, error: { message, code } };
}

export function nowIso() {
  return new Date().toISOString();
}