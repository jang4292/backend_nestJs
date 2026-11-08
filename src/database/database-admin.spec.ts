import {
  AdminConnection,
  assertSafeDatabaseName,
  createDatabaseSql,
  DatabaseAdminError,
  DatabaseTarget,
  describeDatabaseError,
  ensureDatabase,
  inspectDatabase,
  redactGrant,
  resetTestDatabase,
  resolveDatabaseTarget,
} from './database-admin';

type Responder = (sql: string, params?: unknown[]) => Record<string, unknown>[];

function fakeConnection(respond: Responder) {
  const queries: { sql: string; params?: unknown[] }[] = [];
  const connection: AdminConnection = {
    query: (sql, params) => {
      queries.push({ sql, params });
      return Promise.resolve(respond(sql, params));
    },
    end: () => Promise.resolve(),
  };
  return { connection, queries };
}

const baseEnv = {
  DB_HOST: 'dev-db.example.com',
  DB_PORT: 13306,
  DB_USERNAME: 'dev_user',
  DB_PASSWORD: 'secret-password',
  DB_DATABASE: 'app_db',
  DB_SSL: false,
  DB_SSL_REJECT_UNAUTHORIZED: true,
};

const target: DatabaseTarget = {
  server: {
    host: 'dev-db.example.com',
    port: 13306,
    user: 'dev_user',
    password: 'secret-password',
  },
  database: 'app_db',
};

describe('resolveDatabaseTarget', () => {
  it('uses DB_* values and omits ssl when DB_SSL=false', () => {
    expect(resolveDatabaseTarget(baseEnv)).toEqual({
      server: {
        host: 'dev-db.example.com',
        port: 13306,
        user: 'dev_user',
        password: 'secret-password',
      },
      database: 'app_db',
    });
  });

  it('prefers DATABASE_URL host, port, credentials and database like TypeORM', () => {
    const resolved = resolveDatabaseTarget({
      ...baseEnv,
      DATABASE_URL: 'mariadb://url_user:p%40ss@url-host:3307/url_db',
    });

    expect(resolved.server).toMatchObject({
      host: 'url-host',
      port: 3307,
      user: 'url_user',
      password: 'p@ss',
    });
    expect(resolved.database).toBe('url_db');
  });

  it('passes TLS options and connect timeout through', () => {
    const resolved = resolveDatabaseTarget(
      {
        ...baseEnv,
        DB_SSL: true,
        DB_SSL_CA: '/ca.pem',
        DB_CONNECT_TIMEOUT_MS: 5000,
      },
      () => 'CA',
    );

    expect(resolved.server.ssl).toEqual({ rejectUnauthorized: true, ca: 'CA' });
    expect(resolved.server.connectTimeout).toBe(5000);
  });
});

describe('assertSafeDatabaseName / createDatabaseSql', () => {
  it('accepts letters, digits and underscores', () => {
    expect(() => assertSafeDatabaseName('app_db_test')).not.toThrow();
    expect(createDatabaseSql('app_db')).toBe(
      'CREATE DATABASE IF NOT EXISTS `app_db` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci',
    );
  });

  it.each(['app-db', 'app`db', 'app db', '', 'a'.repeat(65)])(
    'rejects unsafe name %p',
    (name) => {
      expect(() => assertSafeDatabaseName(name)).toThrow(DatabaseAdminError);
    },
  );
});

describe('ensureDatabase', () => {
  it('creates the database when it is missing', async () => {
    const { connection, queries } = fakeConnection(() => []);

    await expect(
      ensureDatabase(connection, 'app_db', 'development'),
    ).resolves.toEqual({ created: true });
    expect(queries.map((q) => q.sql)).toEqual([
      'SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?',
      createDatabaseSql('app_db'),
    ]);
    expect(queries[0].params).toEqual(['app_db']);
  });

  it('does nothing when the database already exists', async () => {
    const { connection, queries } = fakeConnection(() => [
      { SCHEMA_NAME: 'app_db' },
    ]);

    await expect(
      ensureDatabase(connection, 'app_db', 'development'),
    ).resolves.toEqual({ created: false });
    expect(queries).toHaveLength(1);
  });

  it('refuses to run in production', async () => {
    const { connection, queries } = fakeConnection(() => []);

    await expect(
      ensureDatabase(connection, 'app_db', 'production'),
    ).rejects.toThrow(/disabled for NODE_ENV=production/);
    expect(queries).toHaveLength(0);
  });

  it('rejects unsafe names before querying', async () => {
    const { connection, queries } = fakeConnection(() => []);

    await expect(
      ensureDatabase(connection, 'app`; DROP', 'test'),
    ).rejects.toThrow(DatabaseAdminError);
    expect(queries).toHaveLength(0);
  });
});

describe('resetTestDatabase', () => {
  it('drops and recreates a *_test database in the test environment', async () => {
    const { connection, queries } = fakeConnection(() => []);

    await resetTestDatabase(connection, 'app_db_test', 'test');

    expect(queries.map((q) => q.sql)).toEqual([
      'DROP DATABASE IF EXISTS `app_db_test`',
      createDatabaseSql('app_db_test'),
    ]);
  });

  it.each([
    ['app_db', 'test'],
    ['app_db_test', 'development'],
    ['app_db_test', 'production'],
  ] as const)('refuses %s with NODE_ENV=%s', async (database, nodeEnv) => {
    const { connection, queries } = fakeConnection(() => []);

    await expect(
      resetTestDatabase(connection, database, nodeEnv),
    ).rejects.toThrow(DatabaseAdminError);
    expect(queries).toHaveLength(0);
  });
});

describe('inspectDatabase', () => {
  const grant =
    "GRANT USAGE ON *.* TO `dev_user`@`%` IDENTIFIED BY PASSWORD '*ABCDEF0123456789'";

  it('reports server, TLS, database and redacted grants', async () => {
    const { connection } = fakeConnection((sql) => {
      if (sql.startsWith('SELECT VERSION()')) {
        return [{ version: '10.11.11-MariaDB', currentUser: 'dev_user@%' }];
      }
      if (sql.startsWith('SHOW SESSION STATUS')) {
        return [{ Variable_name: 'Ssl_cipher', Value: '' }];
      }
      if (sql.includes('information_schema.SCHEMATA')) {
        return [{ charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' }];
      }
      if (sql.includes('information_schema.TABLES')) {
        return [{ count: 7 }];
      }
      return [{ 'Grants for dev_user@%': grant }];
    });

    await expect(inspectDatabase(connection, 'app_db')).resolves.toEqual({
      serverVersion: '10.11.11-MariaDB',
      currentUser: 'dev_user@%',
      tlsCipher: null,
      database: {
        name: 'app_db',
        exists: true,
        charset: 'utf8mb4',
        collation: 'utf8mb4_unicode_ci',
        tableCount: 7,
      },
      grants: [
        "GRANT USAGE ON *.* TO `dev_user`@`%` IDENTIFIED BY PASSWORD '<redacted>'",
      ],
    });
  });

  it('reports a missing database without counting tables', async () => {
    const { connection, queries } = fakeConnection((sql) => {
      if (sql.startsWith('SELECT VERSION()')) {
        return [{ version: '10.11.11-MariaDB', currentUser: 'dev_user@%' }];
      }
      if (sql.startsWith('SHOW SESSION STATUS')) {
        return [{ Value: 'TLS_AES_256_GCM_SHA384' }];
      }
      return [];
    });

    const status = await inspectDatabase(connection, 'app_db');

    expect(status.tlsCipher).toBe('TLS_AES_256_GCM_SHA384');
    expect(status.database).toEqual({ name: 'app_db', exists: false });
    expect(
      queries.some((q) => q.sql.includes('information_schema.TABLES')),
    ).toBe(false);
  });
});

describe('redactGrant', () => {
  it('hides password hashes and authentication strings', () => {
    expect(
      redactGrant(
        "GRANT USAGE ON *.* TO `u`@`%` IDENTIFIED VIA mysql_native_password USING '*HASH' OR unix_socket",
      ),
    ).toBe(
      "GRANT USAGE ON *.* TO `u`@`%` IDENTIFIED VIA mysql_native_password USING '<redacted>' OR unix_socket",
    );
    expect(redactGrant('GRANT ALL PRIVILEGES ON `app_db`.* TO `u`@`%`')).toBe(
      'GRANT ALL PRIVILEGES ON `app_db`.* TO `u`@`%`',
    );
  });
});

describe('describeDatabaseError', () => {
  it.each([
    [
      { code: 'ER_ACCESS_DENIED_ERROR', errno: 1045 },
      /DB_USERNAME and DB_PASSWORD/,
    ],
    [{ code: 'ER_HOST_NOT_PRIVILEGED', errno: 1130 }, /from this host/],
    [{ code: 'ER_HOST_IS_BLOCKED', errno: 1129 }, /FLUSH HOSTS/],
    [{ code: 'ER_DBACCESS_DENIED_ERROR', errno: 1044 }, /GRANT SELECT, INSERT/],
    [{ code: 'ER_BAD_DB_ERROR', errno: 1049 }, /db:setup/],
    [{ code: 'HANDSHAKE_NO_SSL_SUPPORT' }, /DB_SSL=false/],
    [
      { code: 'ECONNREFUSED' },
      /Connection refused by dev-db\.example\.com:13306/,
    ],
    [{ code: 'ETIMEDOUT' }, /Timed out/],
    [{ code: 'ENOTFOUND' }, /Cannot resolve host/],
  ])('explains %p', (error, expected) => {
    expect(describeDatabaseError(error, target)).toMatch(expected);
  });

  it('never includes the password', () => {
    const messages = [
      { code: 'ER_ACCESS_DENIED_ERROR' },
      { code: 'ER_DBACCESS_DENIED_ERROR' },
      { code: 'ECONNREFUSED' },
      new Error('boom'),
    ].map((error) => describeDatabaseError(error, target));

    for (const message of messages) {
      expect(message).not.toContain('secret-password');
    }
  });

  it('falls back to the driver message', () => {
    expect(
      describeDatabaseError({ code: 'ER_X', message: 'odd failure' }, target),
    ).toBe('ER_X: odd failure');
  });
});
