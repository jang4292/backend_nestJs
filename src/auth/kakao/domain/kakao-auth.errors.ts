import { SocialAuthError } from '../../shared/domain/social-auth.error';

/** Stable error code enum – no framework imports */
export enum KakaoAuthErrorCode {
  AUTH_KAKAO_BAD_REQUEST = 'AUTH_KAKAO_BAD_REQUEST',
  AUTH_KAKAO_STATE_MISMATCH = 'AUTH_KAKAO_STATE_MISMATCH',
  AUTH_KAKAO_EXCHANGE_FAILED = 'AUTH_KAKAO_EXCHANGE_FAILED',
  AUTH_KAKAO_PROFILE_FETCH_FAILED = 'AUTH_KAKAO_PROFILE_FETCH_FAILED',
  /** accessToken이 이 앱(KAKAO_APP_ID)에서 발급되지 않음 */
  AUTH_KAKAO_INVALID_TOKEN = 'AUTH_KAKAO_INVALID_TOKEN',
  AUTH_KAKAO_CONFIG_MISSING = 'AUTH_KAKAO_CONFIG_MISSING',
  AUTH_KAKAO_INTERNAL_ERROR = 'AUTH_KAKAO_INTERNAL_ERROR',
}

export class KakaoAuthError extends SocialAuthError {
  declare readonly errorCode: KakaoAuthErrorCode;

  constructor(
    errorCode: KakaoAuthErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(errorCode, message, options);
  }
}
