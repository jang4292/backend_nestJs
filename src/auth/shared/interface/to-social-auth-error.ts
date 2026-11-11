import { SocialAuthError } from '../domain/social-auth.error';

/**
 * 컨트롤러 catch 블록용: 이미 SocialAuthError면 그대로, 아니면(DB 오류 등) provider의
 * INTERNAL_ERROR로 감싸 원인(cause)을 보존합니다. 원본 메시지는 응답에 노출되지 않습니다.
 */
export function toSocialAuthError(
  error: unknown,
  wrapUnexpected: (cause: unknown) => SocialAuthError,
): SocialAuthError {
  return error instanceof SocialAuthError ? error : wrapUnexpected(error);
}
