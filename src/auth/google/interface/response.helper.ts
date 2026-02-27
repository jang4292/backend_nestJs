export function successResponse<T>(requestId: string, data: T) {
  return { ok: true as const, requestId, data };
}

export function errorResponse(
  requestId: string,
  errorCode: string,
  message: string,
  details?: unknown,
) {
  return {
    ok: false as const,
    requestId,
    errorCode,
    message,
    ...(details !== undefined && { details }),
  };
}
