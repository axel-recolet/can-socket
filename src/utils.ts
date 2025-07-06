/**
 * Utility functions for error handling and type safety
 */

/**
 * Type guard to check if an error is a SocketCANError
 */
export function isSocketCANError(
  error: unknown
): error is import("../types/socketcan").SocketCANError {
  return error instanceof Error && "code" in error;
}

/**
 * Safely extract error message from unknown error
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

/**
 * Safely extract error code from unknown error
 */
export function getErrorCode(error: unknown): string | undefined {
  if (isSocketCANError(error)) {
    return error.code;
  }
  return undefined;
}

/**
 * Format error for display
 */
export function formatError(error: unknown): string {
  const code = getErrorCode(error);
  const message = getErrorMessage(error);
  return code ? `[${code}]: ${message}` : message;
}
