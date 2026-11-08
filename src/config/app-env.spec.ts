import { validateAppEnv } from './app-env';

const baseEnv = {
  JWT_SECRET: 'test-secret-with-enough-length-for-hs256',
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

  it('requires Google allowed audiences when Google is enabled', () => {
    const env: Record<string, unknown> = {
      ...baseEnv,
      AUTH_GOOGLE_ENABLED: 'true',
    };
    delete env.GOOGLE_ALLOWED_AUDIENCES;

    expect(() => validateAppEnv(env)).toThrow(
      'GOOGLE_ALLOWED_AUDIENCES is required.',
    );
  });

  describe('SNS providers are explicit opt-in', () => {
    it('keeps every provider disabled when no AUTH_*_ENABLED flag is set, even if credentials exist', () => {
      const env = validateAppEnv({
        ...baseEnv,
        APPLE_ALLOWED_AUDIENCES: 'com.example.web',
        KAKAO_REST_API_KEY: 'kakao-key',
        NAVER_CLIENT_ID: 'naver-id',
        FACEBOOK_APP_ID: 'fb-id',
      });

      expect(env).toMatchObject({
        AUTH_GOOGLE_ENABLED: false,
        AUTH_APPLE_ENABLED: false,
        AUTH_KAKAO_ENABLED: false,
        AUTH_NAVER_ENABLED: false,
        AUTH_FACEBOOK_ENABLED: false,
        AUTH_NAVER_ACCESS_TOKEN_LOGIN_ENABLED: false,
      });
    });

    it('starts in production with only local login (no SNS settings at all)', () => {
      const env = validateAppEnv({
        JWT_SECRET: 'a'.repeat(40),
        DB_USERNAME: 'app',
        DB_PASSWORD: 'pw',
        DB_DATABASE: 'app_db',
        NODE_ENV: 'production',
        CORS_ORIGIN: 'none',
      });

      expect(env.AUTH_GOOGLE_ENABLED).toBe(false);
      expect(env.CORS_ORIGINS).toEqual([]);
    });

    it('rejects a non-boolean provider flag with its own name', () => {
      expect(() =>
        validateAppEnv({ ...baseEnv, AUTH_KAKAO_ENABLED: 'yes' }),
      ).toThrow('AUTH_KAKAO_ENABLED must be true or false.');
    });

    it('parses the Naver accessToken login switch', () => {
      expect(
        validateAppEnv({
          ...baseEnv,
          AUTH_NAVER_ACCESS_TOKEN_LOGIN_ENABLED: 'true',
        }).AUTH_NAVER_ACCESS_TOKEN_LOGIN_ENABLED,
      ).toBe(true);
    });
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
    ).toThrow('CORS_ORIGIN is required when NODE_ENV=production');
  });

  it('accepts CORS_ORIGIN=none as an explicit opt-out in production', () => {
    expect(
      validateAppEnv({
        ...baseEnv,
        NODE_ENV: 'production',
        CORS_ORIGIN: 'none',
      }).CORS_ORIGINS,
    ).toEqual([]);
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

  it('allows token-only Google login when code flow is not configured', () => {
    expect(
      validateAppEnv({
        ...baseEnv,
        NODE_ENV: 'production',
        CORS_ORIGIN: 'https://example.com',
        AUTH_GOOGLE_ENABLED: 'true',
      }).AUTH_GOOGLE_ENABLED,
    ).toBe(true);
  });

  it('requires complete Google code-flow configuration when partially configured', () => {
    expect(() =>
      validateAppEnv({
        ...baseEnv,
        NODE_ENV: 'production',
        CORS_ORIGIN: 'https://example.com',
        AUTH_GOOGLE_ENABLED: 'true',
        GOOGLE_OAUTH_CLIENT_ID: 'client-id',
      }),
    ).toThrow(
      'Enabled provider configuration is missing: GOOGLE_OAUTH_CLIENT_SECRET, GOOGLE_OAUTH_REDIRECT_URIS.',
    );
  });

  it('allows a disabled provider without provider credentials in production', () => {
    expect(
      validateAppEnv({
        ...baseEnv,
        NODE_ENV: 'production',
        CORS_ORIGIN: 'https://example.com',
        AUTH_GOOGLE_ENABLED: 'false',
        GOOGLE_ALLOWED_AUDIENCES: undefined,
      }).AUTH_GOOGLE_ENABLED,
    ).toBe(false);
  });

  it('requires Kakao redirect allowlist when Kakao is enabled in production', () => {
    expect(() =>
      validateAppEnv({
        ...baseEnv,
        NODE_ENV: 'production',
        CORS_ORIGIN: 'https://example.com',
        AUTH_KAKAO_ENABLED: 'true',
        KAKAO_REST_API_KEY: 'kakao-rest-key',
      }),
    ).toThrow(
      'Enabled provider configuration is missing: KAKAO_REDIRECT_URIS.',
    );
  });

  it('requires Facebook redirect allowlist when Facebook is enabled in production', () => {
    expect(() =>
      validateAppEnv({
        ...baseEnv,
        NODE_ENV: 'production',
        CORS_ORIGIN: 'https://example.com',
        AUTH_FACEBOOK_ENABLED: 'true',
        FACEBOOK_APP_ID: 'facebook-app-id',
        FACEBOOK_APP_SECRET: 'facebook-app-secret',
      }),
    ).toThrow(
      'Enabled provider configuration is missing: FACEBOOK_REDIRECT_URIS.',
    );
  });

  it.each(['DB_USERNAME', 'DB_PASSWORD', 'DB_DATABASE'] as const)(
    'requires %s',
    (variable) => {
      const env = { ...baseEnv };
      delete env[variable];

      expect(() => validateAppEnv(env)).toThrow(`${variable} is required.`);
    },
  );

  it('only allows *_test databases in the test environment', () => {
    expect(() =>
      validateAppEnv({
        ...baseEnv,
        NODE_ENV: 'test',
      }),
    ).toThrow('DB_DATABASE must end with _test when NODE_ENV=test.');

    // 개발 DB(app_db)를 e2e에서 쓰던 예외는 제거되었습니다.
    expect(() =>
      validateAppEnv({
        ...baseEnv,
        NODE_ENV: 'test',
        DB_DATABASE: 'app_db',
      }),
    ).toThrow('DB_DATABASE must end with _test when NODE_ENV=test.');

    expect(
      validateAppEnv({
        ...baseEnv,
        NODE_ENV: 'test',
        DB_DATABASE: 'app_db_test',
      }).DB_DATABASE,
    ).toBe('app_db_test');
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

  describe('production JWT_SECRET', () => {
    const productionEnv = {
      ...baseEnv,
      NODE_ENV: 'production',
      CORS_ORIGIN: 'https://example.com',
    };

    it('rejects placeholder secrets from the example files', () => {
      expect(() =>
        validateAppEnv({
          ...productionEnv,
          JWT_SECRET: 'replace-with-a-strong-production-secret',
        }),
      ).toThrow('JWT_SECRET must be a strong production secret.');
    });

    it('rejects secrets shorter than 32 characters', () => {
      expect(() =>
        validateAppEnv({ ...productionEnv, JWT_SECRET: 'a'.repeat(31) }),
      ).toThrow('JWT_SECRET must be at least 32 characters in production.');
    });

    it('accepts a 32+ character secret', () => {
      expect(
        validateAppEnv({ ...productionEnv, JWT_SECRET: 'a'.repeat(32) })
          .JWT_SECRET,
      ).toHaveLength(32);
    });

    it('does not enforce the length rule outside production', () => {
      expect(
        validateAppEnv({ ...baseEnv, JWT_SECRET: 'short' }).JWT_SECRET,
      ).toBe('short');
    });
  });

  describe('CORS_ORIGIN', () => {
    it('parses a comma-separated origin list', () => {
      expect(
        validateAppEnv({
          ...baseEnv,
          CORS_ORIGIN: 'https://a.example.com, https://b.example.com',
        }).CORS_ORIGINS,
      ).toEqual(['https://a.example.com', 'https://b.example.com']);
    });

    it('returns an empty list when unset', () => {
      expect(validateAppEnv(baseEnv).CORS_ORIGINS).toEqual([]);
    });

    it('rejects a wildcard origin', () => {
      expect(() => validateAppEnv({ ...baseEnv, CORS_ORIGIN: '*' })).toThrow(
        'CORS_ORIGIN must list explicit origins; "*" is not allowed.',
      );
    });
  });

  describe('TRUST_PROXY', () => {
    it.each([
      [undefined, false],
      ['false', false],
      ['true', true],
      ['1', 1],
      ['loopback', 'loopback'],
    ])('parses %p as %p', (value, expected) => {
      expect(
        validateAppEnv({ ...baseEnv, TRUST_PROXY: value }).TRUST_PROXY,
      ).toBe(expected);
    });
  });

  it('requires APPLE_ALLOWED_AUDIENCES whenever Apple login is enabled', () => {
    expect(() =>
      validateAppEnv({ ...baseEnv, AUTH_APPLE_ENABLED: 'true' }),
    ).toThrow(
      'APPLE_ALLOWED_AUDIENCES is required when Apple login is enabled.',
    );
  });

  it('requires KAKAO_APP_ID when Kakao is enabled in production', () => {
    expect(() =>
      validateAppEnv({
        ...baseEnv,
        NODE_ENV: 'production',
        CORS_ORIGIN: 'https://example.com',
        AUTH_KAKAO_ENABLED: 'true',
        KAKAO_REST_API_KEY: 'kakao-rest-key',
        KAKAO_REDIRECT_URIS: 'https://example.com/auth/kakao/callback',
      }),
    ).toThrow('Enabled provider configuration is missing: KAKAO_APP_ID.');
  });

  it('rejects JWT_EXPIRES_IN values the session issuer cannot interpret', () => {
    expect(() =>
      validateAppEnv({ ...baseEnv, JWT_EXPIRES_IN: '7 days' }),
    ).toThrow(
      'JWT_EXPIRES_IN must be a positive duration such as 3600, 30m, 1h or 7d.',
    );
  });
});
