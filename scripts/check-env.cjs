#!/usr/bin/env node
'use strict';

/**
 * env 파일을 앱과 같은 규칙으로 읽어 검증만 합니다(서버·DB 연결 없음). 비밀번호·secret 값은 출력하지 않습니다.
 *
 *   node scripts/check-env.cjs <development|test|production>
 *
 * 운영에서 `pm2:reload` 전에 실행하면, 설정 오류로 프로세스가 재시작을 반복하는 상황을 막을 수 있습니다.
 * 빌드 결과(dist/config/*)를 사용하므로 먼저 `npm run build`가 필요합니다.
 */
const { existsSync } = require('node:fs');
const path = require('node:path');

const ENVIRONMENTS = ['development', 'test', 'production'];
const SNS_FLAGS = [
  'AUTH_GOOGLE_ENABLED',
  'AUTH_APPLE_ENABLED',
  'AUTH_KAKAO_ENABLED',
  'AUTH_NAVER_ENABLED',
  'AUTH_FACEBOOK_ENABLED',
];

function main(argv) {
  const [environment] = argv;
  if (!ENVIRONMENTS.includes(environment)) {
    process.stderr.write(
      `Usage: node scripts/check-env.cjs <${ENVIRONMENTS.join('|')}>\n`,
    );
    return 2;
  }

  const root = path.resolve(__dirname, '..');
  const distConfig = path.join(root, 'dist', 'config');
  if (!existsSync(path.join(distConfig, 'app-env.js'))) {
    process.stderr.write('dist/config not found. Run `npm run build` first.\n');
    return 1;
  }

  process.env.NODE_ENV = environment;
  const { resolveEnvFilePath, assertEnvFileAvailable } = require(
    path.join(distConfig, 'env-files.js'),
  );
  const { validateAppEnv } = require(path.join(distConfig, 'app-env.js'));

  const envFile = resolveEnvFilePath(process.env, root);
  try {
    assertEnvFileAvailable(envFile);
    const fileValues = existsSync(envFile)
      ? require('dotenv').parse(require('node:fs').readFileSync(envFile))
      : {};
    // 앱과 같은 우선순위: 셸 환경변수가 파일 값보다 우선
    const env = validateAppEnv({ ...fileValues, ...process.env });

    const enabled = SNS_FLAGS.filter((flag) => env[flag]).map((flag) =>
      flag.replace(/^AUTH_|_ENABLED$/g, '').toLowerCase(),
    );
    process.stdout.write(
      [
        `OK  NODE_ENV=${env.NODE_ENV}`,
        `    env file : ${displayPath(root, envFile)}${existsSync(envFile) ? '' : ' (not found; using process env only)'}`,
        `    database : ${env.DB_HOST}:${env.DB_PORT}/${env.DB_DATABASE} (ssl=${env.DB_SSL})`,
        `    sns login: ${enabled.length > 0 ? enabled.join(', ') : 'all disabled (local login only)'}`,
        `    cors     : ${env.CORS_ORIGINS.length > 0 ? env.CORS_ORIGINS.join(', ') : 'disabled'}`,
        `    trust proxy: ${String(env.TRUST_PROXY)}`,
      ].join('\n') + '\n',
    );
    return 0;
  } catch (error) {
    process.stderr.write(
      `FAIL ${error instanceof Error ? error.message : String(error)}\n`,
    );
    return 1;
  }
}

function displayPath(root, file) {
  const relative = path.relative(root, file);
  return relative && !relative.startsWith('..') ? relative : file;
}

if (require.main === module) {
  process.exitCode = main(process.argv.slice(2));
}

module.exports = { main };
