import { join } from 'node:path';
import {
  createDatabaseOptions,
  DatabaseConfig,
  DEFAULT_MIGRATIONS_GLOB,
} from './database-options';

const baseConfig: DatabaseConfig = {
  DB_HOST: 'localhost',
  DB_PORT: 3306,
  DB_USERNAME: 'user',
  DB_PASSWORD: 'pass',
  DB_DATABASE: 'testdb',
  DB_SYNCHRONIZE: false,
  DB_SSL: false,
  DB_SSL_REJECT_UNAUTHORIZED: true,
};

describe('createDatabaseOptions', () => {
  it('uses DATABASE_URL when provided', () => {
    const options = createDatabaseOptions({
      ...baseConfig,
      DATABASE_URL: 'mariadb://user:pass@host:3306/db',
    });

    expect(options).toMatchObject({ url: 'mariadb://user:pass@host:3306/db' });
    expect(options).not.toHaveProperty('host');
    expect(options).not.toHaveProperty('port');
    expect(options).not.toHaveProperty('username');
    expect(options).not.toHaveProperty('password');
    expect(options).not.toHaveProperty('database');
  });

  it('falls back to host-based config when DATABASE_URL is absent', () => {
    const options = createDatabaseOptions(baseConfig);

    expect(options).toMatchObject({
      host: 'localhost',
      port: 3306,
      username: 'user',
      password: 'pass',
      database: 'testdb',
    });
    expect(options).not.toHaveProperty('url');
  });

  it('includes ssl options when DB_SSL is true', () => {
    const options = createDatabaseOptions({
      ...baseConfig,
      DB_SSL: true,
      DB_SSL_REJECT_UNAUTHORIZED: false,
    });

    expect(options).toMatchObject({ ssl: { rejectUnauthorized: false } });
  });

  it('omits ssl options when DB_SSL is false', () => {
    const options = createDatabaseOptions(baseConfig);

    expect(options).not.toHaveProperty('ssl');
  });

  it('defaults migrations to the migrations folder next to this file', () => {
    const options = createDatabaseOptions(baseConfig);

    // jest는 src(.ts)에서 실행되므로 src/database/migrations/*.ts를 가리킵니다.
    expect(options.migrations).toEqual([join(__dirname, 'migrations', '*.ts')]);
    expect(DEFAULT_MIGRATIONS_GLOB).toBe(join(__dirname, 'migrations', '*.ts'));
  });

  it('uses provided migrations when specified', () => {
    const options = createDatabaseOptions({
      ...baseConfig,
      migrations: ['src/database/migrations/*.ts'],
    });

    expect(options.migrations).toEqual(['src/database/migrations/*.ts']);
  });

  it('defaults logging to false', () => {
    const options = createDatabaseOptions(baseConfig);

    expect(options.logging).toBe(false);
  });

  it('forwards logging when set', () => {
    const options = createDatabaseOptions({ ...baseConfig, logging: true });

    expect(options.logging).toBe(true);
  });

  it('sets type to mariadb', () => {
    const options = createDatabaseOptions(baseConfig);

    expect(options.type).toBe('mariadb');
  });

  it('loads SSL CA bundle when DB_SSL_CA is configured', () => {
    const readCaFile = jest.fn().mockReturnValue('CERT_DATA');

    const options = createDatabaseOptions(
      {
        ...baseConfig,
        DB_SSL: true,
        DB_SSL_CA: '/tmp/rds-ca.pem',
      },
      readCaFile,
    );

    expect(readCaFile).toHaveBeenCalledWith('/tmp/rds-ca.pem', 'utf8');
    expect(options).toMatchObject({
      ssl: { rejectUnauthorized: true, ca: 'CERT_DATA' },
    });
  });

  it('sets mariadb extra options when timeout and pool config are provided', () => {
    const options = createDatabaseOptions({
      ...baseConfig,
      DB_POOL_MIN: 2,
      DB_POOL_MAX: 10,
      DB_CONNECT_TIMEOUT_MS: 5000,
    });

    expect(options).toMatchObject({
      extra: {
        connectionLimit: 10,
        connectTimeout: 5000,
      },
    });
    expect(options.extra).not.toHaveProperty('min');
  });
});
