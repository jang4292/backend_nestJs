'use strict';

/**
 * 애플리케이션 프로세스에 전달하는 환경변수 이름 목록(단일 출처).
 *
 * - ecosystem.config.cjs: PM2로 기동할 때 현재 셸에서 이 키만 골라 전달합니다.
 * - scripts/export-secrets-env.cjs: Secrets Manager SecretString에서 이 키만 export합니다.
 *
 * src/config/app-env.ts의 AppEnv에 키를 추가하면 여기에도 추가해야 합니다.
 * src/config/runtime-env-keys.spec.ts가 두 목록의 불일치를 검사합니다.
 */
const RUNTIME_ENV_KEYS = Object.freeze([
  // Application
  'ENV_FILE',
  'PORT',
  'NODE_ENV',
  'TRUST_PROXY',
  // Database
  'DB_TYPE',
  'DB_HOST',
  'DB_PORT',
  'DB_USERNAME',
  'DB_PASSWORD',
  'DB_DATABASE',
  'DATABASE_URL',
  'DB_SYNCHRONIZE',
  'DB_SSL',
  'DB_SSL_REJECT_UNAUTHORIZED',
  'DB_SSL_CA',
  'DB_POOL_MIN',
  'DB_POOL_MAX',
  'DB_CONNECT_TIMEOUT_MS',
  // Session / API security
  'JWT_SECRET',
  'JWT_EXPIRES_IN',
  'THROTTLE_TTL',
  'THROTTLE_LIMIT',
  'CORS_ORIGIN',
  // SNS provider switches
  'AUTH_GOOGLE_ENABLED',
  'AUTH_APPLE_ENABLED',
  'AUTH_KAKAO_ENABLED',
  'AUTH_NAVER_ENABLED',
  'AUTH_FACEBOOK_ENABLED',
  'AUTH_NAVER_ACCESS_TOKEN_LOGIN_ENABLED',
  // Google
  'GOOGLE_ALLOWED_AUDIENCES',
  'GOOGLE_ALLOWED_ISSUERS',
  'GOOGLE_OAUTH_CLIENT_ID',
  'GOOGLE_OAUTH_CLIENT_SECRET',
  'GOOGLE_OAUTH_REDIRECT_URIS',
  // Apple
  'APPLE_ALLOWED_AUDIENCES',
  'APPLE_SERVICE_ID',
  'APPLE_TEAM_ID',
  'APPLE_KEY_ID',
  'APPLE_PRIVATE_KEY',
  'APPLE_REDIRECT_URIS',
  // Kakao
  'KAKAO_APP_ID',
  'KAKAO_REST_API_KEY',
  'KAKAO_CLIENT_SECRET',
  'KAKAO_REDIRECT_URIS',
  // Naver
  'NAVER_CLIENT_ID',
  'NAVER_CLIENT_SECRET',
  'NAVER_REDIRECT_URIS',
  // Facebook
  'FACEBOOK_APP_ID',
  'FACEBOOK_APP_SECRET',
  'FACEBOOK_REDIRECT_URIS',
  'FACEBOOK_GRAPH_API_VERSION',
]);

module.exports = { RUNTIME_ENV_KEYS };
