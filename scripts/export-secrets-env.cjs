#!/usr/bin/env node
'use strict';

const { execFileSync } = require('node:child_process');

const ALLOWED_ENV_KEYS = Object.freeze([
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
]);

const RDS_MANAGED_SECRET_KEY_MAP = Object.freeze({
  host: 'DB_HOST',
  port: 'DB_PORT',
  username: 'DB_USERNAME',
  password: 'DB_PASSWORD',
  dbname: 'DB_DATABASE',
  database: 'DB_DATABASE',
});

function main() {
  const secretId = process.env.AWS_SECRET_ID;
  if (!secretId) {
    throw new Error('AWS_SECRET_ID is required.');
  }

  const secretString = readSecretString(secretId, process.env.AWS_REGION);
  const env = createEnvironmentFromSecretString(secretString);
  process.stdout.write(`${formatExports(env)}\n`);
}

function readSecretString(secretId, region) {
  const args = [
    'secretsmanager',
    'get-secret-value',
    '--secret-id',
    secretId,
    '--query',
    'SecretString',
    '--output',
    'text',
  ];

  if (region) {
    args.push('--region', region);
  }

  const output = execFileSync('aws', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();

  if (!output || output === 'None') {
    throw new Error('Secrets Manager returned an empty SecretString.');
  }

  return output;
}

function createEnvironmentFromSecretString(secretString) {
  const parsed = parseSecretString(secretString);

  if (typeof parsed === 'string') {
    return { DB_PASSWORD: parsed };
  }

  const env = {};
  for (const [sourceKey, envKey] of Object.entries(
    RDS_MANAGED_SECRET_KEY_MAP,
  )) {
    assignScalarValue(env, envKey, parsed[sourceKey]);
  }

  for (const envKey of ALLOWED_ENV_KEYS) {
    assignScalarValue(env, envKey, parsed[envKey]);
  }

  if (Object.keys(env).length === 0) {
    throw new Error('SecretString did not contain supported environment keys.');
  }

  return env;
}

function parseSecretString(secretString) {
  const trimmed = secretString.trim();
  if (!trimmed) {
    throw new Error('SecretString is empty.');
  }

  try {
    const parsed = JSON.parse(trimmed);
    if (typeof parsed === 'string') {
      return parsed;
    }
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed;
    }
  } catch {
    return trimmed;
  }

  throw new Error(
    'SecretString must be a JSON object, JSON string, or password string.',
  );
}

function assignScalarValue(env, key, value) {
  if (
    !ALLOWED_ENV_KEYS.includes(key) ||
    value === undefined ||
    value === null
  ) {
    return;
  }

  if (
    typeof value !== 'string' &&
    typeof value !== 'number' &&
    typeof value !== 'boolean'
  ) {
    throw new Error(
      `Secret value for ${key} must be a string, number, or boolean.`,
    );
  }

  env[key] = String(value);
}

function formatExports(env) {
  return Object.entries(env)
    .map(([key, value]) => `export ${key}=${shellQuote(value)}`)
    .join('\n');
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, "'\\''")}'`;
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    process.stderr.write(`Failed to export secrets: ${message}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  ALLOWED_ENV_KEYS,
  createEnvironmentFromSecretString,
  formatExports,
  parseSecretString,
};
