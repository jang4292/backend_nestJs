import { validateAppEnv } from './app-env';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { RUNTIME_ENV_KEYS } = require('../../scripts/runtime-env-keys.cjs') as {
  RUNTIME_ENV_KEYS: readonly string[];
};

/** AppEnv 중 다른 키에서 파생되어 프로세스 환경변수로 받지 않는 값 */
const DERIVED_KEYS = new Set(['CORS_ORIGINS']);

describe('scripts/runtime-env-keys.cjs', () => {
  it('lists every environment variable read by validateAppEnv', () => {
    const appEnvKeys = Object.keys(
      validateAppEnv({
        JWT_SECRET: 'test-secret',
        GOOGLE_ALLOWED_AUDIENCES: 'web-client.apps.googleusercontent.com',
        DB_USERNAME: 'user',
        DB_PASSWORD: 'password',
        DB_DATABASE: 'database',
      }),
    ).filter((key) => !DERIVED_KEYS.has(key));

    const missing = appEnvKeys.filter((key) => !RUNTIME_ENV_KEYS.includes(key));
    expect(missing).toEqual([]);
  });

  it('does not contain duplicates', () => {
    expect(new Set(RUNTIME_ENV_KEYS).size).toBe(RUNTIME_ENV_KEYS.length);
  });
});
