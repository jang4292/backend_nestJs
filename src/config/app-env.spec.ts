import { validateAppEnv } from './app-env';

const baseEnv = {
  JWT_SECRET: 'test-secret-with-enough-length',
  GOOGLE_ALLOWED_AUDIENCES: 'web-client.apps.googleusercontent.com',
  DB_USERNAME: 'test_user',
  DB_PASSWORD: 'test_password',
  DB_DATABASE: 'test_database',
};

describe('validateAppEnv', () => {
  it('parses defaults and primitive values', () => {
    const env = validateAppEnv({
      ...baseEnv,
      PORT: '4000',
      DB_PORT: '13306',
      DB_SYNCHRONIZE: 'true',
      THROTTLE_TTL: '120',
      THROTTLE_LIMIT: '20',
    });

    expect(env).toMatchObject({
      PORT: 4000,
      NODE_ENV: 'development',
      DB_TYPE: 'mariadb',
      DB_PORT: 13306,
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
    const env = { ...baseEnv };
    delete env.GOOGLE_ALLOWED_AUDIENCES;

    expect(() => validateAppEnv(env)).toThrow(
      'GOOGLE_ALLOWED_AUDIENCES is required.',
    );
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

  it('only supports MariaDB', () => {
    expect(() =>
      validateAppEnv({
        ...baseEnv,
        DB_TYPE: 'postgres',
      }),
    ).toThrow('Only DB_TYPE=mariadb is supported.');
  });

  it('requires DB_PASSWORD in production', () => {
    expect(() =>
      validateAppEnv({
        ...baseEnv,
        NODE_ENV: 'production',
        CORS_ORIGIN: 'https://example.com',
        DB_PASSWORD: undefined,
      }),
    ).toThrow('DB_PASSWORD is required.');
  });

  it.each(['DB_USERNAME', 'DB_PASSWORD', 'DB_DATABASE'] as const)(
    'requires %s',
    (variable) => {
      const env = { ...baseEnv };
      delete env[variable];

      expect(() => validateAppEnv(env)).toThrow(`${variable} is required.`);
    },
  );

  it('allows the current shared test database and dedicated test databases', () => {
    expect(() =>
      validateAppEnv({
        ...baseEnv,
        NODE_ENV: 'test',
      }),
    ).toThrow(
      'DB_DATABASE must be app_db or end with _test when NODE_ENV=test.',
    );

    expect(
      validateAppEnv({
        ...baseEnv,
        NODE_ENV: 'test',
        DB_DATABASE: 'app_db',
      }).DB_DATABASE,
    ).toBe('app_db');

    expect(
      validateAppEnv({
        ...baseEnv,
        NODE_ENV: 'test',
        DB_DATABASE: 'nestjs_test',
      }).DB_DATABASE,
    ).toBe('nestjs_test');
  });

  it('parses RDS SSL settings and an optional connection URL', () => {
    const env = validateAppEnv({
      ...baseEnv,
      DB_SSL: 'true',
      DB_SSL_REJECT_UNAUTHORIZED: 'false',
      DATABASE_URL: 'mariadb://user:password@example.com:3306/app',
      DB_POOL_MIN: '2',
      DB_POOL_MAX: '10',
      DB_CONNECT_TIMEOUT_MS: '5000',
    });

    expect(env).toMatchObject({
      DB_SSL: true,
      DB_SSL_REJECT_UNAUTHORIZED: false,
      DATABASE_URL: 'mariadb://user:password@example.com:3306/app',
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
