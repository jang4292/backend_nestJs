import { validateAppEnv } from './app-env';

const baseEnv = {
  JWT_SECRET: 'test-secret-with-enough-length',
  GOOGLE_ALLOWED_AUDIENCES: 'web-client.apps.googleusercontent.com',
};

describe('validateAppEnv', () => {
  it('parses defaults and primitive values', () => {
    const env = validateAppEnv({
      ...baseEnv,
      PORT: '4000',
      DB_PORT: '15432',
      DB_SYNCHRONIZE: 'true',
      THROTTLE_TTL: '120',
      THROTTLE_LIMIT: '20',
    });

    expect(env).toMatchObject({
      PORT: 4000,
      NODE_ENV: 'development',
      DB_TYPE: 'postgres',
      DB_PORT: 15432,
      DB_SYNCHRONIZE: true,
      DB_SSL: false,
      DB_SSL_REJECT_UNAUTHORIZED: true,
      THROTTLE_TTL: 120,
      THROTTLE_LIMIT: 20,
    });
  });

  it('requires JWT_SECRET', () => {
    expect(() =>
      validateAppEnv({
        GOOGLE_ALLOWED_AUDIENCES: 'web-client.apps.googleusercontent.com',
      }),
    ).toThrow('JWT_SECRET is required.');
  });

  it('requires Google allowed audiences', () => {
    expect(() =>
      validateAppEnv({
        JWT_SECRET: 'test-secret-with-enough-length',
      }),
    ).toThrow('GOOGLE_ALLOWED_AUDIENCES is required.');
  });

  it('blocks synchronize in production', () => {
    expect(() =>
      validateAppEnv({
        ...baseEnv,
        NODE_ENV: 'production',
        CORS_ORIGIN: 'https://app.example.com',
        DB_SYNCHRONIZE: 'true',
      }),
    ).toThrow('DB_SYNCHRONIZE must be false in production.');
  });

  it('requires CORS_ORIGIN in production', () => {
    expect(() =>
      validateAppEnv({
        ...baseEnv,
        NODE_ENV: 'production',
      }),
    ).toThrow('CORS_ORIGIN is required when NODE_ENV=production.');
  });

  it('rejects an unsupported DB_TYPE', () => {
    expect(() =>
      validateAppEnv({
        ...baseEnv,
        DB_TYPE: 'sqlite',
      }),
    ).toThrow('DB_TYPE must be one of: postgres, mysql.');
  });

  it('accepts mysql as DB_TYPE and defaults its port to 3306', () => {
    const env = validateAppEnv({
      ...baseEnv,
      DB_TYPE: 'mysql',
    });

    expect(env.DB_TYPE).toBe('mysql');
    expect(env.DB_PORT).toBe(3306);
  });

  it('requires DB_PASSWORD in production', () => {
    expect(() =>
      validateAppEnv({
        ...baseEnv,
        NODE_ENV: 'production',
        CORS_ORIGIN: 'https://example.com',
        DB_PASSWORD: undefined,
      }),
    ).toThrow('DB_PASSWORD is required when NODE_ENV=production.');
  });

  it('parses RDS SSL settings and an optional connection URL', () => {
    const env = validateAppEnv({
      ...baseEnv,
      DB_SSL: 'true',
      DB_SSL_REJECT_UNAUTHORIZED: 'false',
      DATABASE_URL: 'postgresql://user:password@example.com:5432/app',
      DB_POOL_MIN: '2',
      DB_POOL_MAX: '10',
      DB_CONNECT_TIMEOUT_MS: '5000',
    });

    expect(env).toMatchObject({
      DB_SSL: true,
      DB_SSL_REJECT_UNAUTHORIZED: false,
      DATABASE_URL: 'postgresql://user:password@example.com:5432/app',
      DB_POOL_MIN: 2,
      DB_POOL_MAX: 10,
      DB_CONNECT_TIMEOUT_MS: 5000,
    });
  });

  it('requires DB_SSL_CA in production when SSL verification is enabled', () => {
    expect(() =>
      validateAppEnv({
        ...baseEnv,
        NODE_ENV: 'production',
        CORS_ORIGIN: 'https://app.example.com',
        DB_SSL: 'true',
      }),
    ).toThrow(
      'DB_SSL_CA is required in production when DB_SSL=true and certificate verification is enabled.',
    );
  });

  it('rejects invalid pool min/max combinations', () => {
    expect(() =>
      validateAppEnv({
        ...baseEnv,
        DB_POOL_MIN: '10',
        DB_POOL_MAX: '2',
      }),
    ).toThrow('DB_POOL_MIN must be less than or equal to DB_POOL_MAX.');
  });

  it('rejects invalid RDS SSL flags', () => {
    expect(() =>
      validateAppEnv({
        ...baseEnv,
        DB_SSL: 'enabled',
      }),
    ).toThrow('DB_SSL must be true or false.');
  });
});
