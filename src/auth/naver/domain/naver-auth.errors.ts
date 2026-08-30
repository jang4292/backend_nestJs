/** Stable error code enum – no framework imports */
export enum NaverAuthErrorCode {
  AUTH_NAVER_BAD_REQUEST = 'AUTH_NAVER_BAD_REQUEST',
  AUTH_NAVER_STATE_MISMATCH = 'AUTH_NAVER_STATE_MISMATCH',
  AUTH_NAVER_EXCHANGE_FAILED = 'AUTH_NAVER_EXCHANGE_FAILED',
  AUTH_NAVER_PROFILE_FETCH_FAILED = 'AUTH_NAVER_PROFILE_FETCH_FAILED',
  AUTH_NAVER_CONFIG_MISSING = 'AUTH_NAVER_CONFIG_MISSING',
  AUTH_NAVER_INTERNAL_ERROR = 'AUTH_NAVER_INTERNAL_ERROR',
}

export class NaverAuthError extends Error {
  constructor(
    public readonly errorCode: NaverAuthErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'NaverAuthError';
  }
}
