'use strict';

const { RUNTIME_ENV_KEYS } = require('./scripts/runtime-env-keys.cjs');

/**
 * PM2에 전달할 환경변수. 기본 운영 경로는 프로젝트 루트의 .env.production이며(앱이 직접 읽음),
 * 현재 셸에 export된 키(예: Secrets Manager export)는 파일 값보다 우선합니다.
 */
function pickRuntimeEnv() {
  return RUNTIME_ENV_KEYS.reduce(
    (env, key) => {
      if (process.env[key] !== undefined) {
        env[key] = process.env[key];
      }
      return env;
    },
    {
      NODE_ENV: process.env.NODE_ENV ?? 'production',
      DB_SYNCHRONIZE: process.env.DB_SYNCHRONIZE ?? 'false',
    },
  );
}

module.exports = {
  apps: [
    {
      name: 'backend-nestjs',
      // 앱은 cwd 기준으로 .env.production을 읽습니다(src/config/env-files.ts).
      // pm2를 어느 디렉터리에서 실행하든 프로젝트 루트를 cwd로 고정합니다.
      cwd: __dirname,
      script: 'dist/main.js',
      exec_mode: 'fork',
      instances: 1,
      // SIGINT 후 graceful shutdown(enableShutdownHooks)이 끝날 시간을 줍니다.
      kill_timeout: 10000,
      env: pickRuntimeEnv(),
    },
  ],
};
