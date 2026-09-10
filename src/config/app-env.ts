export type NodeEnvironment = 'development' | 'test' | 'production';

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
  const jwtSecret = requiredString(config.JWT_SECRET, 'JWT_SECRET');

  if (nodeEnv === 'production' && !corsOrigin) {
    throw new Error('CORS_ORIGIN is required when NODE_ENV=production.');
  }

  if (nodeEnv === 'production' && dbSynchronize) {
    throw new Error('DB_SYNCHRONIZE must be false in production.');
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

  const dbType = optionalString(config.DB_TYPE) ?? 'mariadb';
  if (dbType !== 'mariadb') {
    throw new Error('Only DB_TYPE=mariadb is supported.');
  }

  const dbDatabase = requiredString(config.DB_DATABASE, 'DB_DATABASE');
  // Temporary compatibility: the current test account is scoped to app_db.
  // Re-enable the dedicated *_test-only rule after app_db_test is provisioned.
  if (
    nodeEnv === 'test' &&
    dbDatabase !== 'app_db' &&
    !dbDatabase.endsWith('_test')
  ) {
    throw new Error(
      'DB_DATABASE must be app_db or end with _test when NODE_ENV=test.',
    );
  }

  return {
    PORT: parseInteger(config.PORT, 'PORT', 3000, { min: 1 }),
    NODE_ENV: nodeEnv,
    DB_TYPE: 'mariadb',
    DB_HOST: optionalString(config.DB_HOST) ?? 'localhost',
    DB_PORT: parseInteger(config.DB_PORT, 'DB_PORT', 3306, { min: 1 }),
    DB_USERNAME: requiredString(config.DB_USERNAME, 'DB_USERNAME'),
    DB_PASSWORD: requiredString(config.DB_PASSWORD, 'DB_PASSWORD'),
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
    JWT_EXPIRES_IN: optionalString(config.JWT_EXPIRES_IN) ?? '1h',
    THROTTLE_TTL: parseInteger(config.THROTTLE_TTL, 'THROTTLE_TTL', 60, {
      min: 1,
    }),
    THROTTLE_LIMIT: parseInteger(config.THROTTLE_LIMIT, 'THROTTLE_LIMIT', 10, {
      min: 1,
    }),
    CORS_ORIGIN: corsOrigin,
    GOOGLE_ALLOWED_AUDIENCES: requiredString(
      config.GOOGLE_ALLOWED_AUDIENCES,
      'GOOGLE_ALLOWED_AUDIENCES',
    ),
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

function isPlaceholderSecret(value: string): boolean {
  const normalized = value.toLowerCase();
  return normalized.includes('change-this') || normalized.includes('your-');
}
