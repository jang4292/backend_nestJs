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

/** 로그·오류 응답에 실릴 수 있는 문자열에서 비밀번호, 토큰, 연결 문자열 비밀값을 가립니다. */
export function redactSensitiveText(value: string): string {
  return value
    .replace(DATABASE_URL_SECRET_PATTERN, `$1${SENSITIVE_VALUE_PLACEHOLDER}$3`)
    .replace(KEY_VALUE_SECRET_PATTERN, `$1$2${SENSITIVE_VALUE_PLACEHOLDER}$4`)
    .replace(BEARER_TOKEN_PATTERN, `$1${SENSITIVE_VALUE_PLACEHOLDER}`);
}
