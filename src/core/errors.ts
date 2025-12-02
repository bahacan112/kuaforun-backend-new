export class AppError extends Error {
  status: number
  code?: string
  details?: unknown

  constructor(message: string, status = 400, code?: string, details?: unknown) {
    super(message)
    this.status = status
    this.code = code
    this.details = details
  }
}

export function toErrorResponse(err: unknown) {
  const isApp = err instanceof AppError
  return {
    status: isApp ? err.status : 500,
    payload: {
      error: {
        code: isApp ? err.code ?? 'APP_ERROR' : 'INTERNAL_ERROR',
        message: err instanceof Error ? err.message : 'Unknown error',
      },
    },
  }
}