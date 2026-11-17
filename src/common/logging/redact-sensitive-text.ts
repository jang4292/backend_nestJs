const SENSITIVE_VALUE_PLACEHOLDER = '<redacted>';
const SENSITIVE_KEY_PATTERN =
  '(?:password|passwd|pwd|secret|token|authorization|api[_-]?key|access[_-]?key|private[_-]?key|database_url|jwt_secret|db_password|google_oauth_client_secret)';
const KEY_VALUE_SECRET_PATTERN = new RegExp(
  `(${SENSITIVE_KEY_PATTERN}\\s*[:=]\\s*)(["']?)([^"',\\s}\\]]+)(\\2)`,
  'gi',
);
const DATABASE_URL_SECRET_PATTERN =
  /((?:postgres(?:ql)?|mariadb|mysql):\/\/[^:\s/@]+:)([^@\s]+)(@)/gi;
const BEARER_TOKEN_PATTERN = /(Bearer\s+)[A-Za-z0-9._~+/=-]+/gi;

/**
 * 로그·오류 응답에서 알려진 비밀번호·토큰·연결 문자열 패턴을 가립니다.
 * 모든 비밀 형식을 탐지할 수 없으므로 원본 비밀값을 로그와 예외에 넣지 않는 것이 우선입니다.
 * Redact known secret patterns as a safety net; do not put raw secrets in logs or exceptions.
 */
export function redactSensitiveText(value: string): string {
  return value
    .replace(DATABASE_URL_SECRET_PATTERN, `$1${SENSITIVE_VALUE_PLACEHOLDER}$3`)
    .replace(KEY_VALUE_SECRET_PATTERN, `$1$2${SENSITIVE_VALUE_PLACEHOLDER}$4`)
    .replace(BEARER_TOKEN_PATTERN, `$1${SENSITIVE_VALUE_PLACEHOLDER}`);
}
