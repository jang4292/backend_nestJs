import { config } from 'dotenv';
import { join } from 'node:path';
import { DataSource } from 'typeorm';
import { validateAppEnv } from '../config/app-env';
import {
  assertEnvFileAvailable,
  resolveEnvFilePath,
} from '../config/env-files';
import { createDatabaseOptions } from './database-options';

// 앱과 같은 규칙으로 env 파일을 고릅니다(NODE_ENV별, ENV_FILE 우선).
const envFilePath = resolveEnvFilePath();
assertEnvFileAvailable(envFilePath);
config({ path: envFilePath, quiet: true });

// ts-node(src/*.ts)와 빌드 결과(dist/*.js) 양쪽에서 같은 data-source를 씁니다.
// dist에는 .d.ts도 있으므로 실행 중인 파일의 확장자로만 migration을 찾습니다.
const migrationExtension = __filename.endsWith('.ts') ? 'ts' : 'js';

const appEnv = validateAppEnv(process.env);

const dataSource = new DataSource(
  createDatabaseOptions({
    DB_TYPE: appEnv.DB_TYPE,
    DB_HOST: appEnv.DB_HOST,
    DB_PORT: appEnv.DB_PORT,
    DB_USERNAME: appEnv.DB_USERNAME,
    DB_PASSWORD: appEnv.DB_PASSWORD,
    DB_DATABASE: appEnv.DB_DATABASE,
    DATABASE_URL: appEnv.DATABASE_URL,
    DB_SYNCHRONIZE: false,
    DB_SSL: appEnv.DB_SSL,
    DB_SSL_REJECT_UNAUTHORIZED: appEnv.DB_SSL_REJECT_UNAUTHORIZED,
    DB_SSL_CA: appEnv.DB_SSL_CA,
    DB_POOL_MIN: appEnv.DB_POOL_MIN,
    DB_POOL_MAX: appEnv.DB_POOL_MAX,
    DB_CONNECT_TIMEOUT_MS: appEnv.DB_CONNECT_TIMEOUT_MS,
    migrations: [join(__dirname, 'migrations', `*.${migrationExtension}`)],
  }),
);

export default dataSource;
