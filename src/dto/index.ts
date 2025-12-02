// ============================================================================
// DTO EXPORTS
// ============================================================================

export * from "./auth.dto";
export * from "./booking.dto";

// ============================================================================
// VALIDATION UTILITIES
// ============================================================================

import { z } from "zod";
import type { ApiResponse } from "../utils/api-response";

export function validateDto<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: ApiResponse<never> } {
  try {
    const validatedData = schema.parse(data);
    return { success: true, data: validatedData };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessage = error.issues
        .map((err: z.ZodIssue) => `${err.path.join(".")}: ${err.message}`)
        .join(", ");
      
      return {
        success: false,
        error: {
          success: false,
          error: {
            message: `Validation failed: ${errorMessage}`,
            code: "VALIDATION_ERROR"
          }
        }
      };
    }
    
    return {
      success: false,
      error: {
        success: false,
        error: {
          message: "Unknown validation error",
          code: "VALIDATION_ERROR"
        }
      }
    };
  }
}