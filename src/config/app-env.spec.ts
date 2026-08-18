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

  it('only supports PostgreSQL', () => {
    expect(() =>
      validateAppEnv({
        ...baseEnv,
        DB_TYPE: 'mysql',
      }),
    ).toThrow('Only DB_TYPE=postgres is supported.');
  });
});
