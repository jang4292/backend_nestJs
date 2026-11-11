import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getMetadataArgsStorage } from 'typeorm';
import {
  AdminConnection,
  APP_TABLES,
  assertSafeDatabaseName,
  createDatabaseSql,
  DatabaseAdminError,
  DatabaseTarget,
  describeDatabaseError,
  ensureDatabase,
  evaluatePrivileges,
  formatAccount,
  grantSqlFor,
  inspectDatabase,
  inspectOwnership,
  matchesDatabasePattern,
  MIGRATION_PRIVILEGES,
  parseGrant,
  redactGrant,
  resetTestDatabase,
  resolveDatabaseTarget,
} from './database-admin';
import { databaseEntities } from './database-options';

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
  DB_PORT: 3307,
  DB_USERNAME: 'dev_user',
  DB_PASSWORD: 'secret-password',
  DB_DATABASE: 'app_db',
  DB_SSL: false,
  DB_SSL_REJECT_UNAUTHORIZED: true,
};

const target: DatabaseTarget = {
  server: {
    host: 'dev-db.example.com',
    port: 3307,
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
        port: 3307,
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
    // 백틱 안의 '-'는 안전하므로 기존 DB 이름(예: my-db)을 허용합니다.
    expect(() => assertSafeDatabaseName('my-db')).not.toThrow();
    expect(createDatabaseSql('app_db')).toBe(
      'CREATE DATABASE IF NOT EXISTS `app_db` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci',
    );
  });

  it.each(['app`db', 'app db', "app'db", 'app.db', '', 'a'.repeat(65)])(
    'rejects unsafe name %p',
    (name) => {
      expect(() => assertSafeDatabaseName(name)).toThrow(DatabaseAdminError);
    },
  );
});

// DB 단위 권한만 있는 개발 계정(DROP 없음)
const DEV_GRANTS = [
  "GRANT USAGE ON *.* TO `dev_user`@`%` IDENTIFIED BY PASSWORD '*HASH'",
  'GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, INDEX, ALTER ON `my-db`.* TO `dev_user`@`%`',
];
const FULL_GRANTS = [
  'GRANT USAGE ON *.* TO `dev_user`@`%`',
  'GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, DROP, INDEX ON `app_db`.* TO `dev_user`@`%`',
];

interface DbObjects {
  tables?: { name: string; type?: string }[];
  routines?: { name: string; type: string }[];
  events?: string[];
}

function adminResponder(
  grants: string[],
  existing: string[],
  objects: DbObjects = {},
): Responder {
  return (sql, params) => {
    if (sql.startsWith('SELECT CURRENT_USER()')) {
      return [{ currentUser: 'dev_user@%' }];
    }
    if (sql.startsWith('SHOW GRANTS')) {
      return grants.map((grant) => ({ 'Grants for dev_user@%': grant }));
    }
    if (sql.includes('information_schema.SCHEMATA')) {
      return existing.includes(String(params?.[0]))
        ? [{ SCHEMA_NAME: params?.[0] }]
        : [];
    }
    if (sql.includes('information_schema.TABLES')) {
      return (objects.tables ?? []).map((table) => ({
        name: table.name,
        type: table.type ?? 'BASE TABLE',
      }));
    }
    if (sql.includes('information_schema.ROUTINES')) {
      return objects.routines ?? [];
    }
    if (sql.includes('information_schema.EVENTS')) {
      return (objects.events ?? []).map((name) => ({ name }));
    }
    return [];
  };
}

/** 실행된 쓰기 SQL이 대상 DB 하나만 참조하는지 확인합니다(다른 DB는 절대 바꾸지 않음). */
function expectWritesOnlyTouch(
  queries: { sql: string }[],
  database: string,
): void {
  const writes = queries.filter((q) =>
    /^(CREATE|DROP|ALTER|RENAME|GRANT|REVOKE|TRUNCATE|DELETE|INSERT|UPDATE)\b/i.test(
      q.sql,
    ),
  );
  for (const { sql } of writes) {
    const referenced = [...sql.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
    expect(referenced).toEqual([database]);
  }
}

describe('ensureDatabase', () => {
  it('creates the database when it is missing and privileges are sufficient', async () => {
    const { connection, queries } = fakeConnection(
      adminResponder(FULL_GRANTS, []),
    );

    await expect(
      ensureDatabase(connection, 'app_db', 'development'),
    ).resolves.toMatchObject({ created: true });
    expect(queries.at(-1)?.sql).toBe(createDatabaseSql('app_db'));
  });

  it('does nothing when the database already exists', async () => {
    const { connection, queries } = fakeConnection(
      adminResponder(FULL_GRANTS, ['app_db']),
    );

    await expect(
      ensureDatabase(connection, 'app_db', 'development'),
    ).resolves.toMatchObject({ created: false });
    expect(queries.some((q) => q.sql.startsWith('CREATE DATABASE'))).toBe(
      false,
    );
  });

  it('stops before changing anything when DROP is missing (migrations would fail midway)', async () => {
    const { connection, queries } = fakeConnection(
      adminResponder(DEV_GRANTS, ['my-db']),
    );

    await expect(
      ensureDatabase(connection, 'my-db', 'development'),
    ).rejects.toThrow(
      "'dev_user'@'%' is missing DROP on `my-db`. Stopped before changing anything",
    );
    await expect(
      ensureDatabase(connection, 'my-db', 'development'),
    ).rejects.toThrow("GRANT DROP ON `my-db`.* TO 'dev_user'@'%';");
    expect(queries.some((q) => /^(CREATE|DROP) /.test(q.sql))).toBe(false);
  });

  it('refuses to create a database the account has no privileges on', async () => {
    const { connection, queries } = fakeConnection(
      adminResponder(DEV_GRANTS, ['my-db']),
    );

    await expect(
      ensureDatabase(connection, 'app_db_test', 'test'),
    ).rejects.toThrow(
      `GRANT ${MIGRATION_PRIVILEGES.join(', ')} ON \`app_db_test\`.* TO 'dev_user'@'%';`,
    );
    expect(queries.some((q) => q.sql.startsWith('CREATE DATABASE'))).toBe(
      false,
    );
  });

  it('refuses a shared database that contains objects of other apps, without changing anything', async () => {
    const { connection, queries } = fakeConnection(
      adminResponder(FULL_GRANTS, ['app_db'], {
        tables: [
          { name: 'users' },
          { name: 'orders' },
          { name: 'v_sales', type: 'VIEW' },
        ],
        routines: [{ name: 'calc', type: 'PROCEDURE' }],
      }),
    );

    await expect(
      ensureDatabase(connection, 'app_db', 'development'),
    ).rejects.toThrow(
      '`app_db` contains 3 object(s) not managed by this app: procedure:calc, table:orders, view:v_sales.',
    );
    expect(queries.some((q) => /^(CREATE|DROP|ALTER)/.test(q.sql))).toBe(false);
  });

  it('only ever writes to the target database', async () => {
    const { connection, queries } = fakeConnection(
      adminResponder(FULL_GRANTS, []),
    );

    await ensureDatabase(connection, 'app_db', 'development');

    expectWritesOnlyTouch(queries, 'app_db');
  });

  it('does not block when privileges cannot be determined (role grants)', async () => {
    const { connection } = fakeConnection(
      adminResponder(['GRANT `app_role` TO `dev_user`@`%`'], []),
    );

    await expect(
      ensureDatabase(connection, 'app_db', 'development'),
    ).resolves.toMatchObject({ created: true });
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

describe('privilege evaluation', () => {
  it('parses database-level and global grants and ignores table-level ones', () => {
    expect(parseGrant(DEV_GRANTS[1])).toEqual({
      privileges: new Set([
        'SELECT',
        'INSERT',
        'UPDATE',
        'DELETE',
        'CREATE',
        'INDEX',
        'ALTER',
      ]),
      databasePattern: 'my-db',
    });
    expect(
      parseGrant(
        'GRANT ALL PRIVILEGES ON *.* TO `root`@`localhost` WITH GRANT OPTION',
      ),
    ).toEqual({ privileges: new Set(['ALL']) });
    expect(
      parseGrant('GRANT SELECT (id, name) ON `app_db`.`users` TO `u`@`%`'),
    ).toBeUndefined();
    expect(parseGrant('GRANT `app_role` TO `u`@`%`')).toBeUndefined();
    expect(parseGrant('GRANT PROXY ON `x`@`%` TO `u`@`%`')).toBeUndefined();
  });

  it('matches MariaDB database wildcards and escapes', () => {
    expect(matchesDatabasePattern('app\\_db%', 'app_db_test')).toBe(true);
    expect(matchesDatabasePattern('app\\_db%', 'appXdb')).toBe(false);
    expect(matchesDatabasePattern('app_db', 'appXdb')).toBe(true);
    expect(matchesDatabasePattern('my-db', 'my-db')).toBe(true);
    expect(matchesDatabasePattern('my-db', 'my-db2')).toBe(false);
  });

  it('reports the missing DROP privilege for the dev-server grants', () => {
    expect(evaluatePrivileges(DEV_GRANTS, 'my-db')).toEqual({
      database: 'my-db',
      effective: [
        'ALTER',
        'CREATE',
        'DELETE',
        'INDEX',
        'INSERT',
        'SELECT',
        'UPDATE',
      ],
      missingForMigrations: ['DROP'],
      canCreateDatabase: true,
      determinate: true,
    });
  });

  it('reports every privilege missing for a database without grants', () => {
    const report = evaluatePrivileges(DEV_GRANTS, 'app_db_test');

    expect(report.missingForMigrations).toEqual([...MIGRATION_PRIVILEGES]);
    expect(report.canCreateDatabase).toBe(false);
  });

  it('accepts ALL PRIVILEGES on the database or globally', () => {
    expect(
      evaluatePrivileges(
        ['GRANT ALL PRIVILEGES ON `app_db_test`.* TO `app_test`@`%`'],
        'app_db_test',
      ).missingForMigrations,
    ).toEqual([]);
    expect(
      evaluatePrivileges(
        ['GRANT ALL PRIVILEGES ON *.* TO `root`@`%` WITH GRANT OPTION'],
        'anything',
      ).effective,
    ).toEqual(['ALL PRIVILEGES']);
  });

  it('is indeterminate with role grants or no grants', () => {
    expect(evaluatePrivileges([], 'app_db').determinate).toBe(false);
    expect(
      evaluatePrivileges(['GRANT `app_role` TO `u`@`%`'], 'app_db').determinate,
    ).toBe(false);
  });

  it('formats accounts and builds GRANT SQL with only the given privileges', () => {
    expect(formatAccount('dev-user@%')).toBe("'dev-user'@'%'");
    expect(formatAccount("o'brien@10.0.0.%")).toBe("'o''brien'@'10.0.0.%'");
    expect(grantSqlFor("'u'@'%'", 'my-db', ['DROP'])).toBe(
      "GRANT DROP ON `my-db`.* TO 'u'@'%';",
    );
  });
});

describe('resetTestDatabase', () => {
  it('drops and recreates an app-owned *_test database', async () => {
    const { connection, queries } = fakeConnection(
      adminResponder(FULL_GRANTS, ['app_db_test'], {
        tables: [{ name: 'users' }, { name: 'migrations' }, { name: 'track' }],
      }),
    );

    await resetTestDatabase(connection, 'app_db_test', 'test');

    const writes = queries.filter((q) => /^(CREATE|DROP)/.test(q.sql));
    expect(writes.map((q) => q.sql)).toEqual([
      'DROP DATABASE IF EXISTS `app_db_test`',
      createDatabaseSql('app_db_test'),
    ]);
    expectWritesOnlyTouch(queries, 'app_db_test');
  });

  it('creates a missing *_test database', async () => {
    const { connection, queries } = fakeConnection(
      adminResponder(FULL_GRANTS, []),
    );

    await resetTestDatabase(connection, 'app_db_test', 'test');

    expect(queries.at(-1)?.sql).toBe(createDatabaseSql('app_db_test'));
  });

  it('refuses to drop a *_test database that contains objects of other apps', async () => {
    const { connection, queries } = fakeConnection(
      adminResponder(FULL_GRANTS, ['app_db_test'], {
        tables: [{ name: 'users' }, { name: 'customer_notes' }],
        events: ['nightly_cleanup'],
      }),
    );

    await expect(
      resetTestDatabase(connection, 'app_db_test', 'test'),
    ).rejects.toThrow(
      '`app_db_test` contains 2 object(s) not managed by this app: event:nightly_cleanup, table:customer_notes.',
    );
    expect(queries.some((q) => q.sql.startsWith('DROP'))).toBe(false);
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

describe('inspectOwnership', () => {
  it('separates app tables from tables, views, routines and events of other apps', async () => {
    const { connection } = fakeConnection(
      adminResponder([], ['app_db'], {
        tables: [
          { name: 'users' },
          { name: 'legacy_track' },
          { name: 'users_backup' },
          { name: 'track', type: 'VIEW' },
          { name: 'seq_orders', type: 'SEQUENCE' },
        ],
        routines: [{ name: 'fn_total', type: 'FUNCTION' }],
        events: ['purge'],
      }),
    );

    await expect(inspectOwnership(connection, 'app_db')).resolves.toEqual({
      database: 'app_db',
      appTables: ['legacy_track', 'users'],
      foreignObjects: [
        'event:purge',
        'function:fn_total',
        'sequence:seq_orders',
        'table:users_backup',
        'view:track',
      ],
    });
  });
});

describe('APP_TABLES', () => {
  it('covers every entity table', () => {
    const entityTables = getMetadataArgsStorage()
      .tables.filter((table) =>
        (databaseEntities as unknown[]).includes(table.target),
      )
      .map((table) => table.name);

    expect(entityTables.length).toBe(databaseEntities.length);
    for (const name of entityTables) {
      expect(APP_TABLES).toContain(name);
    }
  });

  it('covers every table that a migration creates or renames', () => {
    const dir = join(__dirname, 'migrations');
    const names = new Set<string>();
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.ts'))) {
      const source = readFileSync(join(dir, file), 'utf8');
      for (const m of source.matchAll(/new Table\(\{\s*name:\s*'([a-z_]+)'/g)) {
        names.add(m[1]);
      }
      for (const m of source.matchAll(/(\w+)\s+TO\s+(\w+)/g)) {
        names.add(m[1]);
        names.add(m[2]);
      }
    }

    expect(names.size).toBeGreaterThan(5);
    for (const name of names) {
      expect(APP_TABLES).toContain(name);
    }
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
      if (sql.startsWith('SELECT COUNT(*)')) {
        return [{ count: 7 }];
      }
      if (sql.includes('information_schema.TABLES')) {
        return [{ name: 'users', type: 'BASE TABLE' }];
      }
      if (sql.includes('information_schema.ROUTINES')) {
        return [];
      }
      if (sql.includes('information_schema.EVENTS')) {
        return [];
      }
      if (sql === 'SHOW DATABASES') {
        return [
          { Database: 'information_schema' },
          { Database: 'app_db' },
          { Database: 'mysql' },
        ];
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
      privileges: {
        database: 'app_db',
        effective: [],
        missingForMigrations: [...MIGRATION_PRIVILEGES],
        canCreateDatabase: false,
        determinate: true,
      },
      visibleDatabases: ['app_db'],
      ownership: {
        database: 'app_db',
        appTables: ['users'],
        foreignObjects: [],
      },
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
      /Connection refused by dev-db\.example\.com:3307/,
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
