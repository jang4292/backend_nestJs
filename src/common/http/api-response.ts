export interface ApiSuccessResponse<T> {
  ok: true;
  requestId: string;
  data: T;
}

export interface ApiErrorResponse {
  ok: false;
  requestId: string;
  errorCode: string;
  message: string;
  details?: unknown;
}

export function successResponse<T>(
  requestId: string,
  data: T,
): ApiSuccessResponse<T> {
  return { ok: true, requestId, data };
}

export function errorResponse(
  requestId: string,
  errorCode: string,
  message: string,
  details?: unknown,
): ApiErrorResponse {
  return {
    ok: false,
    requestId,
    errorCode,
    message,
    ...(details !== undefined && { details }),
  };
}
