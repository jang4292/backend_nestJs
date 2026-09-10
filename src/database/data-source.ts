import { config } from 'dotenv';
import { existsSync } from 'node:fs';
import { DataSource } from 'typeorm';
import { validateAppEnv } from '../config/app-env';
import { createDatabaseOptions } from './database-options';

const envFilePath = process.env.NODE_ENV === 'test' ? '.env.test.local' : '.env';
config({ path: existsSync(envFilePath) ? envFilePath : '.env' });

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
    migrations: ['src/database/migrations/*.ts'],
  }),
);

export default dataSource;
