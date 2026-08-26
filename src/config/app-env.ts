export type NodeEnvironment = 'development' | 'test' | 'production';

export interface AppEnv {
  PORT: number;
  NODE_ENV: NodeEnvironment;
  DB_TYPE: 'postgres' | 'mysql';
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

  const dbType = optionalString(config.DB_TYPE) ?? 'postgres';
  if (dbType !== 'postgres' && dbType !== 'mysql') {
    throw new Error('DB_TYPE must be one of: postgres, mysql.');
  }

  const dbPassword = optionalString(config.DB_PASSWORD);
  if (nodeEnv === 'production' && !dbPassword) {
    throw new Error('DB_PASSWORD is required when NODE_ENV=production.');
  }

  return {
    PORT: parseInteger(config.PORT, 'PORT', 3000, { min: 1 }),
    NODE_ENV: nodeEnv,
    DB_TYPE: dbType,
    DB_HOST: optionalString(config.DB_HOST) ?? 'localhost',
    DB_PORT: parseInteger(
      config.DB_PORT,
      'DB_PORT',
      dbType === 'mysql' ? 3306 : 5432,
      { min: 1 },
    ),
    DB_USERNAME: optionalString(config.DB_USERNAME) ?? 'postgres',
    DB_PASSWORD: dbPassword ?? 'password',
    DB_DATABASE: optionalString(config.DB_DATABASE) ?? 'nestjs_db',
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
