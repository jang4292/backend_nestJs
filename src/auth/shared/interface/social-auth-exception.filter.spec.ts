import { ArgumentsHost, Logger } from '@nestjs/common';
import { RequestIdService } from '../../../common/request-id/request-id.service';
import { REQUEST_ID_HEADER } from '../../../common/request-id/request-id.constants';
import {
  AppleAuthError,
  AppleAuthErrorCode,
} from '../../apple/domain/apple-auth.errors';
import {
  FacebookAuthError,
  FacebookAuthErrorCode,
} from '../../facebook/domain/facebook-auth.errors';
import {
  GoogleAuthError,
  GoogleAuthErrorCode,
} from '../../google/domain/google-auth.errors';
import {
  KakaoAuthError,
  KakaoAuthErrorCode,
} from '../../kakao/domain/kakao-auth.errors';
import {
  NaverAuthError,
  NaverAuthErrorCode,
} from '../../naver/domain/naver-auth.errors';
import type { SocialAuthError } from '../domain/social-auth.error';
import { SocialAuthExceptionFilter } from './social-auth-exception.filter';
import { toSocialAuthError } from './to-social-auth-error';

function createResponse() {
  return {
    setHeader: jest.fn(),
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };
}

function hostFor(response: ReturnType<typeof createResponse>): ArgumentsHost {
  const request = {
    requestId: 'req-1',
    headers: {},
    url: '/auth/x',
    method: 'POST',
  };
  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as ArgumentsHost;
}

/**
 * 공통 필터로 합치기 전 provider별 필터가 반환하던 HTTP 상태를 그대로 고정합니다(회귀 방지).
 */
const LEGACY_STATUS_CASES: Array<[SocialAuthError, number]> = [
  // Google
  [new GoogleAuthError(GoogleAuthErrorCode.AUTH_GOOGLE_BAD_REQUEST, 'm'), 400],
  [
    new GoogleAuthError(GoogleAuthErrorCode.AUTH_GOOGLE_INVALID_AUDIENCE, 'm'),
    401,
  ],
  [
    new GoogleAuthError(GoogleAuthErrorCode.AUTH_GOOGLE_INVALID_ISSUER, 'm'),
    401,
  ],
  [
    new GoogleAuthError(GoogleAuthErrorCode.AUTH_GOOGLE_TOKEN_EXPIRED, 'm'),
    401,
  ],
  [new GoogleAuthError(GoogleAuthErrorCode.AUTH_GOOGLE_MISSING_SUB, 'm'), 401],
  [
    new GoogleAuthError(GoogleAuthErrorCode.AUTH_GOOGLE_NONCE_MISMATCH, 'm'),
    401,
  ],
  [
    new GoogleAuthError(GoogleAuthErrorCode.AUTH_GOOGLE_STATE_MISMATCH, 'm'),
    401,
  ],
  [
    new GoogleAuthError(GoogleAuthErrorCode.AUTH_GOOGLE_EXCHANGE_FAILED, 'm'),
    401,
  ],
  [
    new GoogleAuthError(GoogleAuthErrorCode.AUTH_GOOGLE_INTERNAL_ERROR, 'm'),
    500,
  ],
  // Apple
  [new AppleAuthError(AppleAuthErrorCode.AUTH_APPLE_BAD_REQUEST, 'm'), 400],
  [
    new AppleAuthError(AppleAuthErrorCode.AUTH_APPLE_INVALID_AUDIENCE, 'm'),
    401,
  ],
  [new AppleAuthError(AppleAuthErrorCode.AUTH_APPLE_INVALID_ISSUER, 'm'), 401],
  [new AppleAuthError(AppleAuthErrorCode.AUTH_APPLE_TOKEN_EXPIRED, 'm'), 401],
  [new AppleAuthError(AppleAuthErrorCode.AUTH_APPLE_MISSING_SUB, 'm'), 401],
  [new AppleAuthError(AppleAuthErrorCode.AUTH_APPLE_STATE_MISMATCH, 'm'), 401],
  [new AppleAuthError(AppleAuthErrorCode.AUTH_APPLE_EXCHANGE_FAILED, 'm'), 401],
  [new AppleAuthError(AppleAuthErrorCode.AUTH_APPLE_CONFIG_MISSING, 'm'), 503],
  [new AppleAuthError(AppleAuthErrorCode.AUTH_APPLE_INTERNAL_ERROR, 'm'), 500],
  // Kakao
  [new KakaoAuthError(KakaoAuthErrorCode.AUTH_KAKAO_BAD_REQUEST, 'm'), 400],
  [new KakaoAuthError(KakaoAuthErrorCode.AUTH_KAKAO_STATE_MISMATCH, 'm'), 401],
  [new KakaoAuthError(KakaoAuthErrorCode.AUTH_KAKAO_EXCHANGE_FAILED, 'm'), 401],
  [
    new KakaoAuthError(KakaoAuthErrorCode.AUTH_KAKAO_PROFILE_FETCH_FAILED, 'm'),
    401,
  ],
  [new KakaoAuthError(KakaoAuthErrorCode.AUTH_KAKAO_INVALID_TOKEN, 'm'), 401],
  [new KakaoAuthError(KakaoAuthErrorCode.AUTH_KAKAO_CONFIG_MISSING, 'm'), 503],
  [new KakaoAuthError(KakaoAuthErrorCode.AUTH_KAKAO_INTERNAL_ERROR, 'm'), 500],
  // Naver
  [new NaverAuthError(NaverAuthErrorCode.AUTH_NAVER_BAD_REQUEST, 'm'), 400],
  [new NaverAuthError(NaverAuthErrorCode.AUTH_NAVER_STATE_MISMATCH, 'm'), 401],
  [new NaverAuthError(NaverAuthErrorCode.AUTH_NAVER_EXCHANGE_FAILED, 'm'), 401],
  [
    new NaverAuthError(NaverAuthErrorCode.AUTH_NAVER_PROFILE_FETCH_FAILED, 'm'),
    401,
  ],
  [new NaverAuthError(NaverAuthErrorCode.AUTH_NAVER_CONFIG_MISSING, 'm'), 503],
  [new NaverAuthError(NaverAuthErrorCode.AUTH_NAVER_INTERNAL_ERROR, 'm'), 500],
  // Facebook
  [
    new FacebookAuthError(FacebookAuthErrorCode.AUTH_FACEBOOK_BAD_REQUEST, 'm'),
    400,
  ],
  [
    new FacebookAuthError(
      FacebookAuthErrorCode.AUTH_FACEBOOK_STATE_MISMATCH,
      'm',
    ),
    401,
  ],
  [
    new FacebookAuthError(
      FacebookAuthErrorCode.AUTH_FACEBOOK_EXCHANGE_FAILED,
      'm',
    ),
    401,
  ],
  [
    new FacebookAuthError(
      FacebookAuthErrorCode.AUTH_FACEBOOK_INVALID_TOKEN,
      'm',
    ),
    401,
  ],
  [
    new FacebookAuthError(
      FacebookAuthErrorCode.AUTH_FACEBOOK_PROFILE_FETCH_FAILED,
      'm',
    ),
    401,
  ],
  [
    new FacebookAuthError(
      FacebookAuthErrorCode.AUTH_FACEBOOK_CONFIG_MISSING,
      'm',
    ),
    503,
  ],
  [
    new FacebookAuthError(
      FacebookAuthErrorCode.AUTH_FACEBOOK_INTERNAL_ERROR,
      'm',
    ),
    500,
  ],
];

describe('SocialAuthExceptionFilter', () => {
  let filter: SocialAuthExceptionFilter;
  let errorSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    filter = new SocialAuthExceptionFilter(new RequestIdService());
    errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });

  afterEach(() => {
    errorSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it.each(LEGACY_STATUS_CASES)(
    'keeps the provider status mapping for %s',
    (error, expectedStatus) => {
      const response = createResponse();

      filter.catch(error, hostFor(response));

      expect(response.status).toHaveBeenCalledWith(expectedStatus);
      expect(response.setHeader).toHaveBeenCalledWith(
        REQUEST_ID_HEADER,
        'req-1',
      );
      expect(response.json).toHaveBeenCalledWith(
        expect.objectContaining({
          ok: false,
          requestId: 'req-1',
          errorCode: error.errorCode,
        }),
      );
    },
  );

  it('passes client-facing messages through for 4xx errors', () => {
    const response = createResponse();

    filter.catch(
      new KakaoAuthError(
        KakaoAuthErrorCode.AUTH_KAKAO_BAD_REQUEST,
        'Provide exactly one of accessToken or code.',
      ),
      hostFor(response),
    );

    expect(response.json).toHaveBeenCalledWith({
      ok: false,
      requestId: 'req-1',
      errorCode: 'AUTH_KAKAO_BAD_REQUEST',
      message: 'Provide exactly one of accessToken or code.',
    });
  });

  it('masks unexpected errors (e.g. DB errors) and logs the cause server-side', () => {
    const response = createResponse();
    const dbError = new Error(
      "Duplicate entry 'alice@example.com' for key 'UQ_users_email'",
    );
    const wrapped = toSocialAuthError(
      dbError,
      (cause) =>
        new KakaoAuthError(
          KakaoAuthErrorCode.AUTH_KAKAO_INTERNAL_ERROR,
          'Unexpected error during Kakao authentication.',
          { cause },
        ),
    );

    filter.catch(wrapped, hostFor(response));

    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.json).toHaveBeenCalledWith({
      ok: false,
      requestId: 'req-1',
      errorCode: 'AUTH_KAKAO_INTERNAL_ERROR',
      message: 'Internal server error',
    });
    expect(errorSpy).toHaveBeenCalledWith(
      'Unexpected error during Kakao authentication.',
      expect.stringContaining('Duplicate entry'),
      expect.objectContaining({ requestId: 'req-1' }),
    );
  });

  it('returns existing SocialAuthErrors unchanged from toSocialAuthError', () => {
    const original = new NaverAuthError(
      NaverAuthErrorCode.AUTH_NAVER_EXCHANGE_FAILED,
      'x',
    );
    expect(toSocialAuthError(original, () => original)).toBe(original);
  });
});
