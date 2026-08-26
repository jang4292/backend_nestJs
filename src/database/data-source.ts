import 'dotenv/config';
import { DataSource } from 'typeorm';
import { createDatabaseOptions } from './database-options';

function parseBoolean(
  value: string | undefined,
  defaultValue: boolean,
): boolean {
  if (value === undefined) {
    return defaultValue;
  }
  if (value !== 'true' && value !== 'false') {
    throw new Error(
      'Database boolean environment values must be true or false.',
    );
  }
  return value === 'true';
}

const dbType =
  process.env.DB_TYPE === 'mysql' ? ('mysql' as const) : ('postgres' as const);

const dataSource = new DataSource(
  createDatabaseOptions({
    DB_TYPE: dbType,
    DB_HOST: process.env.DB_HOST ?? 'localhost',
    DB_PORT: Number(process.env.DB_PORT ?? (dbType === 'mysql' ? 3306 : 5432)),
    DB_USERNAME: process.env.DB_USERNAME ?? 'postgres',
    DB_PASSWORD: process.env.DB_PASSWORD ?? 'password',
    DB_DATABASE: process.env.DB_DATABASE ?? 'nestjs_db',
    DATABASE_URL: process.env.DATABASE_URL,
    DB_SYNCHRONIZE: false,
    DB_SSL: parseBoolean(process.env.DB_SSL, false),
    DB_SSL_REJECT_UNAUTHORIZED: parseBoolean(
      process.env.DB_SSL_REJECT_UNAUTHORIZED,
      true,
    ),
    DB_SSL_CA: process.env.DB_SSL_CA,
    DB_POOL_MIN:
      process.env.DB_POOL_MIN !== undefined
        ? Number(process.env.DB_POOL_MIN)
        : undefined,
    DB_POOL_MAX:
      process.env.DB_POOL_MAX !== undefined
        ? Number(process.env.DB_POOL_MAX)
        : undefined,
    DB_CONNECT_TIMEOUT_MS:
      process.env.DB_CONNECT_TIMEOUT_MS !== undefined
        ? Number(process.env.DB_CONNECT_TIMEOUT_MS)
        : undefined,
    migrations: ['src/database/migrations/*.ts'],
  }),
);

export default dataSource;
