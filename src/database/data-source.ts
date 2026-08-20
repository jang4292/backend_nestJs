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

const dataSource = new DataSource(
  createDatabaseOptions({
    DB_HOST: process.env.DB_HOST ?? 'localhost',
    DB_PORT: Number(process.env.DB_PORT ?? 5432),
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
    migrations: ['src/database/migrations/*.ts'],
  }),
);

export default dataSource;
