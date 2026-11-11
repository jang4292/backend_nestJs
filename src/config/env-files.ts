import { existsSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';

/**
 * 실행 환경(NODE_ENV)별로 읽을 env 파일. 앱(ConfigModule), migration CLI(data-source.ts),
 * e2e(test/e2e-env.ts)가 모두 이 규칙 하나를 사용합니다.
 *
 * | NODE_ENV            | 파일              | 용도                                  |
 * | ------------------- | ----------------- | ------------------------------------- |
 * | development (기본)  | `.env`            | 개발 PC → 외부 개발 DB                |
 * | test                | `.env.test.local` | e2e → 개발 서버의 `*_test` DB (필수)  |
 * | production          | `.env.production` | EC2 + PM2 → localhost MariaDB         |
 *
 * `ENV_FILE`을 지정하면 위 규칙 대신 그 파일 하나만 읽습니다.
 * 이미 프로세스에 있는 환경변수(PM2, Secrets Manager export 등)는 파일 값보다 우선합니다.
 */
export const ENV_FILE_BY_NODE_ENV: Readonly<Record<string, string>> = {
  development: '.env',
  test: '.env.test.local',
  production: '.env.production',
};

const DEFAULT_NODE_ENV = 'development';

type EnvSource = Record<string, string | undefined>;

export function resolveEnvFilePath(
  env: EnvSource = process.env,
  cwd: string = process.cwd(),
): string {
  const override = env.ENV_FILE?.trim();
  if (override) {
    return isAbsolute(override) ? override : resolve(cwd, override);
  }

  const nodeEnv = env.NODE_ENV?.trim() || DEFAULT_NODE_ENV;
  const fileName =
    ENV_FILE_BY_NODE_ENV[nodeEnv] ?? ENV_FILE_BY_NODE_ENV[DEFAULT_NODE_ENV];
  return resolve(cwd, fileName);
}

/**
 * test 환경은 개발 DB를 실수로 쓰지 않도록 env 파일이 반드시 있어야 합니다.
 * development/production은 파일이 없어도 프로세스 환경변수로 기동할 수 있으며,
 * 필수 값이 빠지면 validateAppEnv가 원인을 알려 줍니다.
 */
export function assertEnvFileAvailable(
  filePath: string,
  env: EnvSource = process.env,
): void {
  const isTest = (env.NODE_ENV?.trim() || DEFAULT_NODE_ENV) === 'test';
  if (isTest && !env.ENV_FILE && !existsSync(filePath)) {
    throw new Error(
      'Missing .env.test.local. Copy .env.test.example and enter dedicated test database credentials.',
    );
  }
}
