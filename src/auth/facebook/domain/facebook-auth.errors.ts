/** Stable error code enum – no framework imports */
export enum FacebookAuthErrorCode {
  AUTH_FACEBOOK_BAD_REQUEST = 'AUTH_FACEBOOK_BAD_REQUEST',
  AUTH_FACEBOOK_STATE_MISMATCH = 'AUTH_FACEBOOK_STATE_MISMATCH',
  AUTH_FACEBOOK_EXCHANGE_FAILED = 'AUTH_FACEBOOK_EXCHANGE_FAILED',
  AUTH_FACEBOOK_INVALID_TOKEN = 'AUTH_FACEBOOK_INVALID_TOKEN',
  AUTH_FACEBOOK_PROFILE_FETCH_FAILED = 'AUTH_FACEBOOK_PROFILE_FETCH_FAILED',
  AUTH_FACEBOOK_CONFIG_MISSING = 'AUTH_FACEBOOK_CONFIG_MISSING',
  AUTH_FACEBOOK_INTERNAL_ERROR = 'AUTH_FACEBOOK_INTERNAL_ERROR',
}

export class FacebookAuthError extends Error {
  constructor(
    public readonly errorCode: FacebookAuthErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'FacebookAuthError';
  }
}
