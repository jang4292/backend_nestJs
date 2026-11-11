import { SocialAuthError } from '../../shared/domain/social-auth.error';

/** Stable error code enum – no framework imports */
export enum GoogleAuthErrorCode {
  AUTH_GOOGLE_BAD_REQUEST = 'AUTH_GOOGLE_BAD_REQUEST',
  AUTH_GOOGLE_INVALID_AUDIENCE = 'AUTH_GOOGLE_INVALID_AUDIENCE',
  AUTH_GOOGLE_INVALID_ISSUER = 'AUTH_GOOGLE_INVALID_ISSUER',
  AUTH_GOOGLE_TOKEN_EXPIRED = 'AUTH_GOOGLE_TOKEN_EXPIRED',
  AUTH_GOOGLE_MISSING_SUB = 'AUTH_GOOGLE_MISSING_SUB',
  AUTH_GOOGLE_NONCE_MISMATCH = 'AUTH_GOOGLE_NONCE_MISMATCH',
  AUTH_GOOGLE_STATE_MISMATCH = 'AUTH_GOOGLE_STATE_MISMATCH',
  AUTH_GOOGLE_EXCHANGE_FAILED = 'AUTH_GOOGLE_EXCHANGE_FAILED',
  /** 검증에 필요한 설정(audience, redirect 허용 목록)이 없음 → 503 */
  AUTH_GOOGLE_CONFIG_MISSING = 'AUTH_GOOGLE_CONFIG_MISSING',
  AUTH_GOOGLE_INTERNAL_ERROR = 'AUTH_GOOGLE_INTERNAL_ERROR',
}

export class GoogleAuthError extends SocialAuthError {
  declare readonly errorCode: GoogleAuthErrorCode;

  constructor(
    errorCode: GoogleAuthErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(errorCode, message, options);
  }
}
