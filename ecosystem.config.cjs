'use strict';

const ENV_KEYS = [
  'PORT',
  'NODE_ENV',
  'DB_HOST',
  'DB_PORT',
  'DB_USERNAME',
  'DB_PASSWORD',
  'DB_DATABASE',
  'DB_SSL',
  'DB_SSL_REJECT_UNAUTHORIZED',
  'DB_SSL_CA',
  'DB_POOL_MIN',
  'DB_POOL_MAX',
  'DB_CONNECT_TIMEOUT_MS',
  'DB_SYNCHRONIZE',
  'JWT_SECRET',
  'JWT_EXPIRES_IN',
  'THROTTLE_TTL',
  'THROTTLE_LIMIT',
  'CORS_ORIGIN',
  'GOOGLE_ALLOWED_AUDIENCES',
  'GOOGLE_ALLOWED_ISSUERS',
  'GOOGLE_OAUTH_CLIENT_ID',
  'GOOGLE_OAUTH_CLIENT_SECRET',
  'GOOGLE_OAUTH_REDIRECT_URIS',
];

function pickRuntimeEnv() {
  return ENV_KEYS.reduce(
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
      env: pickRuntimeEnv(),
    },
  ],
};
