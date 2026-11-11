/**
 * 5개 SNS provider(Google/Apple/Kakao/Naver/Facebook) 인증 오류의 공통 기반.
 * 순수 도메인 타입이며 프레임워크에 의존하지 않습니다.
 *
 * provider별 오류 코드는 `AUTH_<PROVIDER>_<REASON>` 형식을 유지하고(클라이언트 계약),
 * HTTP 의미는 REASON으로 분류합니다.
 */
export type SocialAuthErrorKind =
  'bad_request' | 'unauthorized' | 'unavailable' | 'internal';

const UNAUTHORIZED_REASONS = [
  'STATE_MISMATCH',
  'EXCHANGE_FAILED',
  'PROFILE_FETCH_FAILED',
  'INVALID_AUDIENCE',
  'INVALID_ISSUER',
  'INVALID_TOKEN',
  'TOKEN_EXPIRED',
  'MISSING_SUB',
  'NONCE_MISMATCH',
] as const;

export function classifySocialAuthErrorCode(
  errorCode: string,
): SocialAuthErrorKind {
  if (errorCode.endsWith('_BAD_REQUEST')) return 'bad_request';
  if (errorCode.endsWith('_CONFIG_MISSING')) return 'unavailable';
  if (UNAUTHORIZED_REASONS.some((reason) => errorCode.endsWith(`_${reason}`))) {
    return 'unauthorized';
  }
  return 'internal';
}

export abstract class SocialAuthError extends Error {
  constructor(
    readonly errorCode: string,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = new.target.name;
  }

  get kind(): SocialAuthErrorKind {
    return classifySocialAuthErrorCode(this.errorCode);
  }
}
