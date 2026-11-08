import type { AppEnv, NodeEnvironment } from '../config/app-env';
import { createSslOptions, type ReadCaFile } from './database-options';

/**
 * DB 서버 관리 로직(db-tool CLI가 사용). 데이터베이스(스키마 컨테이너) 생성·확인만 담당하며,
 * 테이블은 항상 migration으로 만듭니다(docs/learning/database-schema-management.kr.md).
 *
 * 연결은 DB를 지정하지 않고 서버에 접속합니다. 대상 DB가 아직 없어도 확인·생성할 수 있도록 하기 위함입니다.
 * 비밀번호는 어떤 출력에도 포함하지 않습니다.
 */

/** utf8mb4: 이모지 등 4바이트 문자를 저장하기 위한 MariaDB 기본 권장 charset */
export const DATABASE_CHARSET = 'utf8mb4';
export const DATABASE_COLLATION = 'utf8mb4_unicode_ci';

/** 식별자를 SQL에 직접 넣으므로(백틱) 영문·숫자·밑줄만 허용합니다. */
const DATABASE_NAME_PATTERN = /^[A-Za-z0-9_]{1,64}$/;

export interface ServerTarget {
  host: string;
  port: number;
  user: string;
  password: string;
  ssl?: { rejectUnauthorized: boolean; ca?: string };
  connectTimeout?: number;
}

export interface DatabaseTarget {
  server: ServerTarget;
  database: string;
}

/** 테스트에서 가짜 연결을 주입할 수 있도록 mysql2 연결의 필요한 부분만 정의합니다. */
export interface AdminConnection {
  query(sql: string, params?: unknown[]): Promise<Record<string, unknown>[]>;
  end(): Promise<void>;
}

export type AdminConnectionFactory = (
  server: ServerTarget,
) => Promise<AdminConnection>;

export interface DatabaseStatus {
  serverVersion: string;
  currentUser: string;
  /** 사용 중인 TLS cipher. 평문 연결이면 null */
  tlsCipher: string | null;
  database: {
    name: string;
    exists: boolean;
    charset?: string;
    collation?: string;
    tableCount?: number;
  };
  /** SHOW GRANTS 결과(비밀번호 해시는 가림) */
  grants: string[];
}

export class DatabaseAdminError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DatabaseAdminError';
  }
}

/**
 * 앱과 같은 연결 대상을 만듭니다. DATABASE_URL이 있으면 TypeORM처럼 URL의 host·port·DB를 우선합니다.
 */
export function resolveDatabaseTarget(
  env: Pick<
    AppEnv,
    | 'DB_HOST'
    | 'DB_PORT'
    | 'DB_USERNAME'
    | 'DB_PASSWORD'
    | 'DB_DATABASE'
    | 'DATABASE_URL'
    | 'DB_SSL'
    | 'DB_SSL_REJECT_UNAUTHORIZED'
    | 'DB_SSL_CA'
    | 'DB_CONNECT_TIMEOUT_MS'
  >,
  readCaFile?: ReadCaFile,
): DatabaseTarget {
  let host = env.DB_HOST;
  let port = env.DB_PORT;
  let user = env.DB_USERNAME;
  let password = env.DB_PASSWORD;
  let database = env.DB_DATABASE;

  if (env.DATABASE_URL) {
    const url = new URL(env.DATABASE_URL);
    host = url.hostname || host;
    port = url.port ? Number(url.port) : port;
    user = url.username ? decodeURIComponent(url.username) : user;
    password = url.password ? decodeURIComponent(url.password) : password;
    const pathDatabase = decodeURIComponent(url.pathname.replace(/^\//, ''));
    database = pathDatabase || database;
  }

  const ssl = createSslOptions(env, readCaFile);
  return {
    server: {
      host,
      port,
      user,
      password,
      ...(ssl ? { ssl } : {}),
      ...(env.DB_CONNECT_TIMEOUT_MS
        ? { connectTimeout: env.DB_CONNECT_TIMEOUT_MS }
        : {}),
    },
    database,
  };
}

export function assertSafeDatabaseName(name: string): void {
  if (!DATABASE_NAME_PATTERN.test(name)) {
    throw new DatabaseAdminError(
      `DB_DATABASE "${name}" must contain only letters, digits and underscores (max 64).`,
    );
  }
}

/** 읽기 전용: 서버·계정·대상 DB 상태를 조회합니다. */
export async function inspectDatabase(
  connection: AdminConnection,
  database: string,
): Promise<DatabaseStatus> {
  const [identity] = await connection.query(
    'SELECT VERSION() AS version, CURRENT_USER() AS currentUser',
  );
  const tlsRows = await connection.query(
    "SHOW SESSION STATUS LIKE 'Ssl_cipher'",
  );
  const tlsCipher = stringValue(tlsRows[0]?.Value) || null;

  const [schema] = await connection.query(
    'SELECT DEFAULT_CHARACTER_SET_NAME AS charset, DEFAULT_COLLATION_NAME AS collation FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?',
    [database],
  );

  let tableCount: number | undefined;
  if (schema) {
    const [tables] = await connection.query(
      'SELECT COUNT(*) AS count FROM information_schema.TABLES WHERE TABLE_SCHEMA = ?',
      [database],
    );
    tableCount = Number(tables?.count ?? 0);
  }

  const grantRows = await connection.query('SHOW GRANTS FOR CURRENT_USER()');
  const grants = grantRows
    .map((row) => stringValue(Object.values(row)[0]))
    .filter((grant) => grant.length > 0)
    .map(redactGrant);

  return {
    serverVersion: stringValue(identity?.version),
    currentUser: stringValue(identity?.currentUser),
    tlsCipher,
    database: {
      name: database,
      exists: schema !== undefined,
      ...(schema
        ? {
            charset: stringValue(schema.charset),
            collation: stringValue(schema.collation),
            tableCount,
          }
        : {}),
    },
    grants,
  };
}

/**
 * 대상 DB가 없을 때만 utf8mb4로 생성합니다(dev/test 전용).
 * 운영 DB는 관리자 SQL로 1회 만들고, 앱 계정에는 해당 DB 권한만 줍니다(최소 권한).
 */
export async function ensureDatabase(
  connection: AdminConnection,
  database: string,
  nodeEnv: NodeEnvironment,
): Promise<{ created: boolean }> {
  assertEnsureAllowed(database, nodeEnv);

  if (await databaseExists(connection, database)) {
    return { created: false };
  }
  await connection.query(createDatabaseSql(database));
  return { created: true };
}

/**
 * test DB를 비우고 다시 만듭니다. 빈 DB에서 전체 migration 체인을 검증하기 위한 명령이므로
 * NODE_ENV=test 이고 이름이 *_test 인 DB에만 허용합니다.
 */
export async function resetTestDatabase(
  connection: AdminConnection,
  database: string,
  nodeEnv: NodeEnvironment,
): Promise<void> {
  assertResetAllowed(database, nodeEnv);

  await connection.query(`DROP DATABASE IF EXISTS \`${database}\``);
  await connection.query(createDatabaseSql(database));
}

/** db:ensure 허용 조건. 서버에 연결하기 전에 확인합니다. */
export function assertEnsureAllowed(
  database: string,
  nodeEnv: NodeEnvironment,
): void {
  if (nodeEnv === 'production') {
    throw new DatabaseAdminError(
      'db:ensure is disabled for NODE_ENV=production. Create the production database once with the admin SQL in docs/deployment/database-environments.kr.md (section 4.1).',
    );
  }
  assertSafeDatabaseName(database);
}

/** db:reset 허용 조건. 서버에 연결하기 전에 확인합니다. */
export function assertResetAllowed(
  database: string,
  nodeEnv: NodeEnvironment,
): void {
  if (nodeEnv !== 'test' || !database.endsWith('_test')) {
    throw new DatabaseAdminError(
      'db:reset only runs with NODE_ENV=test on a *_test database.',
    );
  }
  assertSafeDatabaseName(database);
}

export function createDatabaseSql(database: string): string {
  assertSafeDatabaseName(database);
  return `CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET ${DATABASE_CHARSET} COLLATE ${DATABASE_COLLATION}`;
}

/** 관리자가 실행할 권한 부여 SQL(권한 부족 안내용). */
export function grantSqlFor(user: string, database: string): string {
  return [
    `CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET ${DATABASE_CHARSET} COLLATE ${DATABASE_COLLATION};`,
    `GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, DROP, INDEX, REFERENCES ON \`${database}\`.* TO '${user}'@'<host>';`,
  ].join('\n');
}

/** MariaDB SHOW GRANTS에 포함되는 비밀번호 해시·인증 문자열을 가립니다. */
export function redactGrant(grant: string): string {
  return grant
    .replace(/(IDENTIFIED BY PASSWORD\s+)'[^']*'/gi, "$1'<redacted>'")
    .replace(/(IDENTIFIED VIA\s+\S+\s+USING\s+)'[^']*'/gi, "$1'<redacted>'")
    .replace(/(USING\s+PASSWORD\()'[^']*'\)/gi, "$1'<redacted>')");
}

interface ErrorShape {
  code?: unknown;
  errno?: unknown;
  message?: unknown;
}

/**
 * 연결·권한 오류를 원인과 조치로 바꿉니다. 비밀번호는 메시지에 넣지 않습니다.
 * @see https://mariadb.com/kb/en/mariadb-error-code-reference/
 */
export function describeDatabaseError(
  error: unknown,
  target: DatabaseTarget,
): string {
  const shape = (
    typeof error === 'object' && error !== null ? error : {}
  ) as ErrorShape;
  const code = typeof shape.code === 'string' ? shape.code : '';
  const errno = typeof shape.errno === 'number' ? shape.errno : undefined;
  const { host, port, user } = target.server;
  const where = `${host}:${port}`;

  if (code === 'ER_ACCESS_DENIED_ERROR' || errno === 1045) {
    return `Access denied for '${user}' (1045). Check DB_USERNAME and DB_PASSWORD in the env file.`;
  }
  if (code === 'ER_HOST_NOT_PRIVILEGED' || errno === 1130) {
    return `The server does not allow '${user}' from this host (1130). Allow your IP in the account host (for example '${user}'@'<your-ip>') on ${where}.`;
  }
  if (code === 'ER_HOST_IS_BLOCKED' || errno === 1129) {
    return `This host is blocked after too many failed connections (1129). Run FLUSH HOSTS (or mariadb-admin flush-hosts) on ${where}.`;
  }
  if (
    code === 'ER_DBACCESS_DENIED_ERROR' ||
    code === 'ER_SPECIFIC_ACCESS_DENIED_ERROR' ||
    errno === 1044 ||
    errno === 1227
  ) {
    return `'${user}' lacks privileges on \`${target.database}\`. Ask a DB admin to run:\n${grantSqlFor(user, target.database)}`;
  }
  if (code === 'ER_BAD_DB_ERROR' || errno === 1049) {
    return `Database \`${target.database}\` does not exist. Run the db:setup script for this environment.`;
  }
  if (code === 'HANDSHAKE_NO_SSL_SUPPORT') {
    return `${where} does not support TLS. Set DB_SSL=false, or enable TLS on the server.`;
  }
  if (code === 'ECONNREFUSED') {
    return `Connection refused by ${where}. Check DB_HOST/DB_PORT and that MariaDB is listening on that port.`;
  }
  if (code === 'ETIMEDOUT' || code === 'EHOSTUNREACH') {
    return `Timed out connecting to ${where}. Check the firewall/port forwarding and your network.`;
  }
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') {
    return `Cannot resolve host "${host}". Check DB_HOST.`;
  }

  const message =
    typeof shape.message === 'string' ? shape.message : String(error);
  return code ? `${code}: ${message}` : message;
}

async function databaseExists(
  connection: AdminConnection,
  database: string,
): Promise<boolean> {
  const rows = await connection.query(
    'SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?',
    [database],
  );
  return rows.length > 0;
}

function stringValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (Buffer.isBuffer(value)) {
    return value.toString('utf8');
  }
  if (typeof value === 'number' || typeof value === 'bigint') {
    return value.toString();
  }
  return '';
}
