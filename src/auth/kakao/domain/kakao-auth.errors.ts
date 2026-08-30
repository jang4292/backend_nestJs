/** Stable error code enum – no framework imports */
export enum KakaoAuthErrorCode {
  AUTH_KAKAO_BAD_REQUEST = 'AUTH_KAKAO_BAD_REQUEST',
  AUTH_KAKAO_STATE_MISMATCH = 'AUTH_KAKAO_STATE_MISMATCH',
  AUTH_KAKAO_EXCHANGE_FAILED = 'AUTH_KAKAO_EXCHANGE_FAILED',
  AUTH_KAKAO_PROFILE_FETCH_FAILED = 'AUTH_KAKAO_PROFILE_FETCH_FAILED',
  AUTH_KAKAO_CONFIG_MISSING = 'AUTH_KAKAO_CONFIG_MISSING',
  AUTH_KAKAO_INTERNAL_ERROR = 'AUTH_KAKAO_INTERNAL_ERROR',
}

export class KakaoAuthError extends Error {
  constructor(
    public readonly errorCode: KakaoAuthErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'KakaoAuthError';
  }
}
