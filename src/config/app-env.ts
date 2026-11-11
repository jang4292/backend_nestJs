import { parseDurationSeconds } from './duration';

export type NodeEnvironment = 'development' | 'test' | 'production';

/** express `trust proxy` 설정 값: false | true | hop 수 | express 문자열(loopback, IP/CIDR 목록 등) */
export type TrustProxySetting = boolean | number | string;

/** production에서 허용하는 JWT_SECRET 최소 길이(HS256 키 엔트로피 확보). */
export const MIN_PRODUCTION_JWT_SECRET_LENGTH = 32;

export interface AppEnv {
  PORT: number;
  NODE_ENV: NodeEnvironment;
  DB_TYPE: 'mariadb';
  DB_HOST: string;
  DB_PORT: number;
  DB_USERNAME: string;
  DB_PASSWORD: string;
  DB_DATABASE: string;
  DATABASE_URL?: string;
  DB_SYNCHRONIZE: boolean;
  DB_SSL: boolean;
  DB_SSL_REJECT_UNAUTHORIZED: boolean;
  DB_SSL_CA?: string;
  DB_POOL_MIN?: number;
  DB_POOL_MAX?: number;
  DB_CONNECT_TIMEOUT_MS?: number;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  THROTTLE_TTL: number;
  THROTTLE_LIMIT: number;
  CORS_ORIGIN?: string;
  /** CORS_ORIGIN을 쉼표로 분리한 명시적 origin 목록. 비어 있으면 CORS 비활성화. */
  CORS_ORIGINS: string[];
  TRUST_PROXY: TrustProxySetting;
  AUTH_GOOGLE_ENABLED: boolean;
  AUTH_APPLE_ENABLED: boolean;
  AUTH_KAKAO_ENABLED: boolean;
  AUTH_NAVER_ENABLED: boolean;
  AUTH_FACEBOOK_ENABLED: boolean;
  /** Naver 클라이언트 accessToken 로그인 허용 여부(기본 false: code flow만) */
  AUTH_NAVER_ACCESS_TOKEN_LOGIN_ENABLED: boolean;
  GOOGLE_ALLOWED_AUDIENCES: string;
  GOOGLE_ALLOWED_ISSUERS: string;
  GOOGLE_OAUTH_CLIENT_ID?: string;
  GOOGLE_OAUTH_CLIENT_SECRET?: string;
  GOOGLE_OAUTH_REDIRECT_URIS?: string;
  APPLE_ALLOWED_AUDIENCES?: string;
  APPLE_SERVICE_ID?: string;
  APPLE_TEAM_ID?: string;
  APPLE_KEY_ID?: string;
  APPLE_PRIVATE_KEY?: string;
  APPLE_REDIRECT_URIS?: string;
  KAKAO_APP_ID?: string;
  KAKAO_REST_API_KEY?: string;
  KAKAO_CLIENT_SECRET?: string;
  KAKAO_REDIRECT_URIS?: string;
  NAVER_CLIENT_ID?: string;
  NAVER_CLIENT_SECRET?: string;
  NAVER_REDIRECT_URIS?: string;
  FACEBOOK_APP_ID?: string;
  FACEBOOK_APP_SECRET?: string;
  FACEBOOK_REDIRECT_URIS?: string;
  FACEBOOK_GRAPH_API_VERSION?: string;
}

type RawEnv = Record<string, unknown>;

const DEFAULT_ALLOWED_ISSUERS =
  'accounts.google.com,https://accounts.google.com';

export function validateAppEnv(config: RawEnv): AppEnv {
  // 환경변수는 앱 기동 전에 파싱합니다. 잘못된 설정은 외부 OAuth 호출이나 DB 연결보다 먼저 실패시킵니다.
  const nodeEnv = parseNodeEnv(config.NODE_ENV);
  const dbSynchronize = parseBoolean(
    config.DB_SYNCHRONIZE,
    'DB_SYNCHRONIZE',
    false,
  );
  const dbSsl = parseBoolean(config.DB_SSL, 'DB_SSL', false);
  const dbSslRejectUnauthorized = parseBoolean(
    config.DB_SSL_REJECT_UNAUTHORIZED,
    'DB_SSL_REJECT_UNAUTHORIZED',
    true,
  );
  const dbSslCa = optionalString(config.DB_SSL_CA);
  const dbPoolMin = parseOptionalInteger(config.DB_POOL_MIN, 'DB_POOL_MIN', {
    min: 0,
  });
  const dbPoolMax = parseOptionalInteger(config.DB_POOL_MAX, 'DB_POOL_MAX', {
    min: 1,
  });
  const dbConnectTimeoutMs = parseOptionalInteger(
    config.DB_CONNECT_TIMEOUT_MS,
    'DB_CONNECT_TIMEOUT_MS',
    { min: 1 },
  );
  const corsOrigin = optionalString(config.CORS_ORIGIN);
  const corsOrigins = parseCorsOrigins(corsOrigin);
  const trustProxy = parseTrustProxy(config.TRUST_PROXY);
  const jwtSecret = requiredString(config.JWT_SECRET, 'JWT_SECRET');
  const jwtExpiresIn = optionalString(config.JWT_EXPIRES_IN) ?? '1h';
  if (parseDurationSeconds(jwtExpiresIn) === undefined) {
    throw new Error(
      'JWT_EXPIRES_IN must be a positive duration such as 3600, 30m, 1h or 7d.',
    );
  }
  const dbUsername = requiredString(config.DB_USERNAME, 'DB_USERNAME');
  const dbPassword = requiredString(config.DB_PASSWORD, 'DB_PASSWORD');
  const dbDatabase = requiredString(config.DB_DATABASE, 'DB_DATABASE');
  // Google audience는 활성화된 Google ID Token 검증에 필수입니다.
  const googleAllowedAudiences = optionalString(
    config.GOOGLE_ALLOWED_AUDIENCES,
  );
  // SNS provider는 명시적 opt-in입니다. AUTH_<PROVIDER>_ENABLED=true일 때만 활성화되며,
  // credential 키가 있어도 플래그가 없으면 꺼진 상태(라우트는 503)로 기동합니다.
  // 재활성화 전 점검: docs/auth/sns-reenable-checklist.kr.md
  const authGoogleEnabled = parseProviderEnabled(
    config.AUTH_GOOGLE_ENABLED,
    'AUTH_GOOGLE_ENABLED',
  );
  const authAppleEnabled = parseProviderEnabled(
    config.AUTH_APPLE_ENABLED,
    'AUTH_APPLE_ENABLED',
  );
  const authKakaoEnabled = parseProviderEnabled(
    config.AUTH_KAKAO_ENABLED,
    'AUTH_KAKAO_ENABLED',
  );
  const authNaverEnabled = parseProviderEnabled(
    config.AUTH_NAVER_ENABLED,
    'AUTH_NAVER_ENABLED',
  );
  const authFacebookEnabled = parseProviderEnabled(
    config.AUTH_FACEBOOK_ENABLED,
    'AUTH_FACEBOOK_ENABLED',
  );
  // Naver는 클라이언트 accessToken의 발급 앱을 검증할 수 없으므로 기본적으로 code flow만 허용합니다.
  const authNaverAccessTokenLoginEnabled = parseBoolean(
    config.AUTH_NAVER_ACCESS_TOKEN_LOGIN_ENABLED,
    'AUTH_NAVER_ACCESS_TOKEN_LOGIN_ENABLED',
    false,
  );

  if (authGoogleEnabled && googleAllowedAudiences === undefined) {
    throw new Error('GOOGLE_ALLOWED_AUDIENCES is required.');
  }

  if (nodeEnv === 'production' && !corsOrigin) {
    throw new Error(
      'CORS_ORIGIN is required when NODE_ENV=production (use CORS_ORIGIN=none to disable CORS explicitly).',
    );
  }

  // synchronize는 entity와 다른 컬럼·인덱스를 자동으로 삭제할 수 있어(데이터 손실) 어떤 환경에서도 쓰지 않습니다.
  // 스키마는 migration으로만 바꿉니다(docs/learning/database-schema-management.kr.md).
  if (dbSynchronize) {
    throw new Error(
      'DB_SYNCHRONIZE must be false. The schema changes only through migrations; synchronize can drop columns and their data.',
    );
  }

  if (
    dbPoolMin !== undefined &&
    dbPoolMax !== undefined &&
    dbPoolMin > dbPoolMax
  ) {
    throw new Error('DB_POOL_MIN must be less than or equal to DB_POOL_MAX.');
  }

  if (
    nodeEnv === 'production' &&
    dbSsl &&
    dbSslRejectUnauthorized &&
    !dbSslCa
  ) {
    throw new Error(
      'DB_SSL_CA is required in production when DB_SSL=true and certificate verification is enabled.',
    );
  }

  if (nodeEnv === 'production' && isPlaceholderSecret(jwtSecret)) {
    throw new Error('JWT_SECRET must be a strong production secret.');
  }

  if (
    nodeEnv === 'production' &&
    jwtSecret.length < MIN_PRODUCTION_JWT_SECRET_LENGTH
  ) {
    throw new Error(
      `JWT_SECRET must be at least ${MIN_PRODUCTION_JWT_SECRET_LENGTH} characters in production.`,
    );
  }

  // Apple ID Token은 aud 검증 없이 받으면 다른 앱용 토큰도 통과하므로 환경과 무관하게 필수입니다.
  if (
    authAppleEnabled &&
    optionalString(config.APPLE_ALLOWED_AUDIENCES) === undefined
  ) {
    throw new Error(
      'APPLE_ALLOWED_AUDIENCES is required when Apple login is enabled.',
    );
  }

  // 클라이언트가 보낸 Kakao accessToken의 발급 앱(app_id) 검증에 사용합니다. 없으면 다른 Kakao 앱의 토큰으로
  // 로그인할 수 있으므로(토큰 치환) Apple aud와 같이 환경과 무관하게 필수입니다.
  if (authKakaoEnabled && optionalString(config.KAKAO_APP_ID) === undefined) {
    throw new Error('KAKAO_APP_ID is required when Kakao login is enabled.');
  }

  // 활성 provider의 기본 검증 설정은 production에서 반드시 존재해야 합니다.
  validateEnabledProviderConfig(nodeEnv, authGoogleEnabled, [
    ['GOOGLE_ALLOWED_AUDIENCES', googleAllowedAudiences],
  ]);
  // code flow 설정은 전부 생략하거나 전부 입력해야 합니다. token-only 운영은 허용합니다.
  validateOptionalProviderConfig(nodeEnv, authGoogleEnabled, [
    ['GOOGLE_OAUTH_CLIENT_ID', optionalString(config.GOOGLE_OAUTH_CLIENT_ID)],
    [
      'GOOGLE_OAUTH_CLIENT_SECRET',
      optionalString(config.GOOGLE_OAUTH_CLIENT_SECRET),
    ],
    [
      'GOOGLE_OAUTH_REDIRECT_URIS',
      optionalString(config.GOOGLE_OAUTH_REDIRECT_URIS),
    ],
  ]);
  validateOptionalProviderConfig(nodeEnv, authAppleEnabled, [
    ['APPLE_SERVICE_ID', optionalString(config.APPLE_SERVICE_ID)],
    ['APPLE_TEAM_ID', optionalString(config.APPLE_TEAM_ID)],
    ['APPLE_KEY_ID', optionalString(config.APPLE_KEY_ID)],
    ['APPLE_PRIVATE_KEY', optionalString(config.APPLE_PRIVATE_KEY)],
    ['APPLE_REDIRECT_URIS', optionalString(config.APPLE_REDIRECT_URIS)],
  ]);
  validateEnabledProviderConfig(nodeEnv, authKakaoEnabled, [
    ['KAKAO_REST_API_KEY', optionalString(config.KAKAO_REST_API_KEY)],
  ]);
  validateEnabledProviderConfig(nodeEnv, authKakaoEnabled, [
    ['KAKAO_REDIRECT_URIS', optionalString(config.KAKAO_REDIRECT_URIS)],
  ]);
  validateEnabledProviderConfig(nodeEnv, authNaverEnabled, [
    ['NAVER_CLIENT_ID', optionalString(config.NAVER_CLIENT_ID)],
  ]);
  validateOptionalProviderConfig(nodeEnv, authNaverEnabled, [
    ['NAVER_CLIENT_SECRET', optionalString(config.NAVER_CLIENT_SECRET)],
    ['NAVER_REDIRECT_URIS', optionalString(config.NAVER_REDIRECT_URIS)],
  ]);
  validateEnabledProviderConfig(nodeEnv, authFacebookEnabled, [
    ['FACEBOOK_APP_ID', optionalString(config.FACEBOOK_APP_ID)],
    ['FACEBOOK_APP_SECRET', optionalString(config.FACEBOOK_APP_SECRET)],
  ]);
  validateEnabledProviderConfig(nodeEnv, authFacebookEnabled, [
    ['FACEBOOK_REDIRECT_URIS', optionalString(config.FACEBOOK_REDIRECT_URIS)],
  ]);

  const dbType = optionalString(config.DB_TYPE) ?? 'mariadb';
  if (dbType !== 'mariadb') {
    throw new Error('Only DB_TYPE=mariadb is supported.');
  }

  // e2e가 개발·운영 데이터를 바꾸지 않도록 test 환경은 *_test DB만 허용합니다(예: app_db_test).
  if (nodeEnv === 'test' && !dbDatabase.endsWith('_test')) {
    throw new Error('DB_DATABASE must end with _test when NODE_ENV=test.');
  }

  return {
    PORT: parseInteger(config.PORT, 'PORT', 3000, { min: 1 }),
    NODE_ENV: nodeEnv,
    DB_TYPE: 'mariadb',
    DB_HOST: optionalString(config.DB_HOST) ?? 'localhost',
    DB_PORT: parseInteger(config.DB_PORT, 'DB_PORT', 3306, { min: 1 }),
    DB_USERNAME: dbUsername,
    DB_PASSWORD: dbPassword,
    DB_DATABASE: dbDatabase,
    DATABASE_URL: optionalString(config.DATABASE_URL),
    DB_SYNCHRONIZE: dbSynchronize,
    DB_SSL: dbSsl,
    DB_SSL_REJECT_UNAUTHORIZED: dbSslRejectUnauthorized,
    DB_SSL_CA: dbSslCa,
    DB_POOL_MIN: dbPoolMin,
    DB_POOL_MAX: dbPoolMax,
    DB_CONNECT_TIMEOUT_MS: dbConnectTimeoutMs,
    JWT_SECRET: jwtSecret,
    JWT_EXPIRES_IN: jwtExpiresIn,
    THROTTLE_TTL: parseInteger(config.THROTTLE_TTL, 'THROTTLE_TTL', 60, {
      min: 1,
    }),
    THROTTLE_LIMIT: parseInteger(config.THROTTLE_LIMIT, 'THROTTLE_LIMIT', 10, {
      min: 1,
    }),
    CORS_ORIGIN: corsOrigin,
    CORS_ORIGINS: corsOrigins,
    TRUST_PROXY: trustProxy,
    AUTH_GOOGLE_ENABLED: authGoogleEnabled,
    AUTH_APPLE_ENABLED: authAppleEnabled,
    AUTH_KAKAO_ENABLED: authKakaoEnabled,
    AUTH_NAVER_ENABLED: authNaverEnabled,
    AUTH_FACEBOOK_ENABLED: authFacebookEnabled,
    AUTH_NAVER_ACCESS_TOKEN_LOGIN_ENABLED: authNaverAccessTokenLoginEnabled,
    GOOGLE_ALLOWED_AUDIENCES: googleAllowedAudiences ?? '',
    GOOGLE_ALLOWED_ISSUERS:
      optionalString(config.GOOGLE_ALLOWED_ISSUERS) ?? DEFAULT_ALLOWED_ISSUERS,
    GOOGLE_OAUTH_CLIENT_ID: optionalString(config.GOOGLE_OAUTH_CLIENT_ID),
    GOOGLE_OAUTH_CLIENT_SECRET: optionalString(
      config.GOOGLE_OAUTH_CLIENT_SECRET,
    ),
    GOOGLE_OAUTH_REDIRECT_URIS: optionalString(
      config.GOOGLE_OAUTH_REDIRECT_URIS,
    ),
    APPLE_ALLOWED_AUDIENCES: optionalString(config.APPLE_ALLOWED_AUDIENCES),
    APPLE_SERVICE_ID: optionalString(config.APPLE_SERVICE_ID),
    APPLE_TEAM_ID: optionalString(config.APPLE_TEAM_ID),
    APPLE_KEY_ID: optionalString(config.APPLE_KEY_ID),
    APPLE_PRIVATE_KEY: optionalString(config.APPLE_PRIVATE_KEY),
    APPLE_REDIRECT_URIS: optionalString(config.APPLE_REDIRECT_URIS),
    KAKAO_APP_ID: optionalString(config.KAKAO_APP_ID),
    KAKAO_REST_API_KEY: optionalString(config.KAKAO_REST_API_KEY),
    KAKAO_CLIENT_SECRET: optionalString(config.KAKAO_CLIENT_SECRET),
    KAKAO_REDIRECT_URIS: optionalString(config.KAKAO_REDIRECT_URIS),
    NAVER_CLIENT_ID: optionalString(config.NAVER_CLIENT_ID),
    NAVER_CLIENT_SECRET: optionalString(config.NAVER_CLIENT_SECRET),
    NAVER_REDIRECT_URIS: optionalString(config.NAVER_REDIRECT_URIS),
    FACEBOOK_APP_ID: optionalString(config.FACEBOOK_APP_ID),
    FACEBOOK_APP_SECRET: optionalString(config.FACEBOOK_APP_SECRET),
    FACEBOOK_REDIRECT_URIS: optionalString(config.FACEBOOK_REDIRECT_URIS),
    FACEBOOK_GRAPH_API_VERSION: optionalString(
      config.FACEBOOK_GRAPH_API_VERSION,
    ),
  };
}

function parseOptionalInteger(
  value: unknown,
  name: string,
  options?: { min?: number },
): number | undefined {
  const parsed = optionalString(value);
  if (parsed === undefined) {
    return undefined;
  }

  return parseInteger(parsed, name, 0, options);
}

function parseProviderEnabled(value: unknown, name: string): boolean {
  return parseBoolean(value, name, false);
}

function validateEnabledProviderConfig(
  nodeEnv: NodeEnvironment,
  enabled: boolean,
  values: Array<[string, string | undefined]>,
): void {
  if (nodeEnv !== 'production' || !enabled) return;

  const missing = values
    .filter(([, value]) => value === undefined)
    .map(([name]) => name);
  if (missing.length > 0) {
    throw new Error(
      `Enabled provider configuration is missing: ${missing.join(', ')}.`,
    );
  }
}

function validateOptionalProviderConfig(
  nodeEnv: NodeEnvironment,
  enabled: boolean,
  values: Array<[string, string | undefined]>,
): void {
  if (nodeEnv !== 'production' || !enabled) return;

  const configured = values.some(([, value]) => value !== undefined);
  if (!configured) return;

  validateEnabledProviderConfig(nodeEnv, true, values);
}

function parseNodeEnv(value: unknown): NodeEnvironment {
  const parsed = optionalString(value) ?? 'development';
  if (
    parsed !== 'development' &&
    parsed !== 'test' &&
    parsed !== 'production'
  ) {
    throw new Error('NODE_ENV must be development, test, or production.');
  }
  return parsed;
}

function requiredString(value: unknown, name: string): string {
  const parsed = optionalString(value);
  if (!parsed) {
    throw new Error(`${name} is required.`);
  }
  return parsed;
}

function optionalString(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (
    typeof value !== 'string' &&
    typeof value !== 'number' &&
    typeof value !== 'boolean'
  ) {
    throw new Error(
      'Environment values must be strings, numbers, or booleans.',
    );
  }
  const parsed = `${value}`.trim();
  return parsed.length > 0 ? parsed : undefined;
}

function parseBoolean(
  value: unknown,
  name: string,
  defaultValue: boolean,
): boolean {
  const parsed = optionalString(value);
  if (parsed === undefined) {
    return defaultValue;
  }
  if (parsed === 'true') {
    return true;
  }
  if (parsed === 'false') {
    return false;
  }
  throw new Error(`${name} must be true or false.`);
}

function parseInteger(
  value: unknown,
  name: string,
  defaultValue: number,
  options?: { min?: number },
): number {
  const parsed = optionalString(value);
  if (parsed === undefined) {
    return defaultValue;
  }

  const numberValue = Number(parsed);
  if (!Number.isInteger(numberValue)) {
    throw new Error(`${name} must be an integer.`);
  }

  if (options?.min !== undefined && numberValue < options.min) {
    throw new Error(`${name} must be greater than or equal to ${options.min}.`);
  }

  return numberValue;
}

/** CORS를 명시적으로 끄는 값. 브라우저 클라이언트가 없는(모바일 전용) 운영에서 사용합니다. */
export const CORS_DISABLED_VALUE = 'none';

function parseCorsOrigins(value: string | undefined): string[] {
  if (value === undefined || value.toLowerCase() === CORS_DISABLED_VALUE) {
    return [];
  }
  const origins = value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  // credentials: true와 함께 '*'를 쓰면 모든 사이트가 인증된 요청을 보낼 수 있으므로 거부합니다.
  if (origins.includes('*')) {
    throw new Error(
      'CORS_ORIGIN must list explicit origins; "*" is not allowed.',
    );
  }
  return origins;
}

function parseTrustProxy(value: unknown): TrustProxySetting {
  const parsed = optionalString(value);
  if (parsed === undefined || parsed === 'false') {
    return false;
  }
  if (parsed === 'true') {
    return true;
  }
  if (/^\d+$/.test(parsed)) {
    return Number(parsed);
  }
  return parsed;
}

const PLACEHOLDER_SECRET_MARKERS = ['change-this', 'your-', 'replace-with'];

function isPlaceholderSecret(value: string): boolean {
  const normalized = value.toLowerCase();
  return PLACEHOLDER_SECRET_MARKERS.some((marker) =>
    normalized.includes(marker),
  );
}
