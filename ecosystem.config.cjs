'use strict';

const { RUNTIME_ENV_KEYS } = require('./scripts/runtime-env-keys.cjs');

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
      script: 'dist/main.js',
      exec_mode: 'fork',
      instances: 1,
      // SIGINT 후 graceful shutdown(enableShutdownHooks)이 끝날 시간을 줍니다.
      kill_timeout: 10000,
      env: pickRuntimeEnv(),
    },
  ],
};
