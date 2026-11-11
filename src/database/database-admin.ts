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

/**
 * 식별자를 백틱으로 감싸 SQL에 직접 넣으므로 영문·숫자·`_`·`-`만 허용합니다(백틱·공백·따옴표 불가).
 * `-`는 백틱 안에서 안전하며, 기존 DB(예: `my-db`)를 그대로 쓸 수 있게 허용합니다.
 */
const DATABASE_NAME_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * migration 전체 체인(up과 최신 revert)에 필요한 DB 단위 권한.
 * - SELECT, INSERT, UPDATE, DELETE: `migrations` 테이블 기록, 데이터 보정(INSERT … SELECT, UPDATE … JOIN)
 * - CREATE: CREATE TABLE. DB 단위로 주면 그 이름의 CREATE DATABASE도 가능
 * - ALTER: 컬럼·FK·제약 변경, RENAME TABLE
 * - DROP: RENAME TABLE의 원본 테이블(ArchiveLegacyMusicSchema), revert의 DROP TABLE, db:reset의 DROP DATABASE
 * - INDEX: CREATE/DROP INDEX
 * REFERENCES는 MariaDB에서 사용되지 않아(FK 생성에도 불필요) 요구하지 않습니다.
 */
export const MIGRATION_PRIVILEGES = [
  'SELECT',
  'INSERT',
  'UPDATE',
  'DELETE',
  'CREATE',
  'ALTER',
  'DROP',
  'INDEX',
] as const;

/**
 * 이 앱의 migration이 만들거나 이름을 바꿔 소유하는 테이블입니다.
 * 이 목록 밖의 객체(다른 테이블, 뷰, 루틴, 이벤트)가 있는 DB는 다른 앱과 공유 중으로 보고
 * db:setup·db:reset이 아무것도 바꾸지 않습니다. spec이 entity·migration 소스와 이 목록을 대조합니다.
 */
export const APP_TABLES: readonly string[] = [
  'users',
  'social_accounts',
  'artist',
  'track',
  'playlist',
  'playlist_track',
  'audio_asset',
  'legacy_artist',
  'legacy_track',
  'legacy_playlist',
  'legacy_playlist_track',
  'migrations',
  'typeorm_metadata',
];

export interface OwnershipReport {
  database: string;
  /** 앱이 관리하는 테이블 */
  appTables: string[];
  /** 앱이 관리하지 않는 객체(`table:x`, `view:x`, `procedure:x`, `function:x`, `event:x` 등) */
  foreignObjects: string[];
}

export interface PrivilegeReport {
  database: string;
  /** 대상 DB에 적용되는 권한(전역 *.* 포함). ALL이면 ['ALL PRIVILEGES'] */
  effective: string[];
  /** MIGRATION_PRIVILEGES 중 없는 권한 */
  missingForMigrations: string[];
  /** 대상 DB를 CREATE DATABASE로 만들 수 있는지 */
  canCreateDatabase: boolean;
  /**
   * false면 role 부여 등으로 권한을 정확히 알 수 없습니다. 이때는 차단하지 않고 경고만 합니다.
   */
  determinate: boolean;
}

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
  /** 대상 DB 기준 권한 평가 */
  privileges: PrivilegeReport;
  /** 이 계정에서 보이는 DB 목록(시스템 DB 제외) */
  visibleDatabases: string[];
  /** 대상 DB가 있을 때, 앱 소유 여부 */
  ownership?: OwnershipReport;
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
      `DB_DATABASE "${name}" must contain only letters, digits, "_" and "-" (max 64).`,
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

  const grants = await readGrants(connection);
  const visibleDatabases = (await connection.query('SHOW DATABASES'))
    .map((row) => stringValue(Object.values(row)[0]))
    .filter((name) => name.length > 0 && !SYSTEM_DATABASES.has(name));

  const ownership = schema
    ? await inspectOwnership(connection, database)
    : undefined;

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
    privileges: evaluatePrivileges(grants, database),
    visibleDatabases,
    ...(ownership ? { ownership } : {}),
  };
}

/**
 * 읽기 전용: 대상 DB 안의 객체가 모두 이 앱 소유인지 확인합니다.
 * 계정에 보이는 객체만 조회되므로, 권한은 DB 단위로 주어 그 DB의 객체가 모두 보이게 합니다.
 */
export async function inspectOwnership(
  connection: AdminConnection,
  database: string,
): Promise<OwnershipReport> {
  const tables = await connection.query(
    'SELECT TABLE_NAME AS name, TABLE_TYPE AS type FROM information_schema.TABLES WHERE TABLE_SCHEMA = ?',
    [database],
  );
  const routines = await connection.query(
    'SELECT ROUTINE_NAME AS name, ROUTINE_TYPE AS type FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA = ?',
    [database],
  );
  const events = await connection.query(
    'SELECT EVENT_NAME AS name FROM information_schema.EVENTS WHERE EVENT_SCHEMA = ?',
    [database],
  );

  const appTables: string[] = [];
  const foreignObjects: string[] = [];
  for (const row of tables) {
    const name = stringValue(row.name);
    const type = stringValue(row.type).toUpperCase();
    const isTable = type === 'BASE TABLE' || type === 'SYSTEM VERSIONED';
    if (isTable && APP_TABLES.includes(name)) {
      appTables.push(name);
    } else {
      foreignObjects.push(`${isTable ? 'table' : type.toLowerCase()}:${name}`);
    }
  }
  for (const row of routines) {
    foreignObjects.push(
      `${stringValue(row.type).toLowerCase() || 'routine'}:${stringValue(row.name)}`,
    );
  }
  for (const row of events) {
    foreignObjects.push(`event:${stringValue(row.name)}`);
  }

  return {
    database,
    appTables: appTables.sort(),
    foreignObjects: foreignObjects.sort(),
  };
}

function assertDedicated(ownership: OwnershipReport, command: string): void {
  if (ownership.foreignObjects.length === 0) {
    return;
  }
  const shown = ownership.foreignObjects.slice(0, 10).join(', ');
  const more =
    ownership.foreignObjects.length > 10
      ? ` and ${ownership.foreignObjects.length - 10} more`
      : '';
  throw new DatabaseAdminError(
    [
      `\`${ownership.database}\` contains ${ownership.foreignObjects.length} object(s) not managed by this app: ${shown}${more}.`,
      `${command} only works on a database dedicated to this app, so nothing was changed. Point DB_DATABASE at a new database (for example app_db_dev).`,
    ].join('\n'),
  );
}

/**
 * 대상 DB가 없을 때만 utf8mb4로 생성합니다(dev/test 전용).
 * 운영 DB는 관리자 SQL로 1회 만들고, 앱 계정에는 해당 DB 권한만 줍니다(최소 권한).
 */
export async function ensureDatabase(
  connection: AdminConnection,
  database: string,
  nodeEnv: NodeEnvironment,
): Promise<{ created: boolean; privileges: PrivilegeReport }> {
  assertEnsureAllowed(database, nodeEnv);

  const [identity] = await connection.query(
    'SELECT CURRENT_USER() AS currentUser',
  );
  const account = formatAccount(stringValue(identity?.currentUser));
  const privileges = evaluatePrivileges(await readGrants(connection), database);
  const exists = await databaseExists(connection, database);

  // 다른 앱의 객체가 있는 DB는 공유 DB로 보고 아무것도 바꾸지 않습니다.
  if (exists) {
    assertDedicated(await inspectOwnership(connection, database), 'db:setup');
  }

  // 권한이 부족하면 아무것도 만들지 않고 멈춥니다. db:setup은 `&&`로 이어지므로
  // migration:run이 시작되지 않아, 체인이 중간에서 멈춘 상태가 생기지 않습니다.
  // CREATE가 없으면 DB 생성도 불가하므로 missingForMigrations 하나로 두 경우를 함께 판단합니다.
  const missing = privileges.missingForMigrations;
  if (privileges.determinate && missing.length > 0) {
    throw new DatabaseAdminError(
      [
        `${account} is missing ${missing.join(', ')} on \`${database}\`${exists ? '' : ' (database does not exist yet)'}. Stopped before changing anything; migrations would otherwise fail midway.`,
        'Ask a DB admin to run:',
        `  ${grantSqlFor(account, database, missing)}`,
      ].join('\n'),
    );
  }

  if (exists) {
    return { created: false, privileges };
  }
  await connection.query(createDatabaseSql(database));
  return { created: true, privileges };
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

  // 앱 소유가 확인된 *_test DB만 지웁니다. 다른 객체가 하나라도 있으면 거부합니다.
  if (await databaseExists(connection, database)) {
    assertDedicated(await inspectOwnership(connection, database), 'db:reset');
  }

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
      'db:ensure is disabled for NODE_ENV=production. Create the production database once with the admin SQL in docs/deployment/database-environments.kr.md (section 5.1).',
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

/** 관리자가 실행할 권한 부여 SQL(권한 부족 안내용). account는 `'user'@'host'` 형식입니다. */
export function grantSqlFor(
  account: string,
  database: string,
  privileges: readonly string[] = MIGRATION_PRIVILEGES,
): string {
  return `GRANT ${privileges.join(', ')} ON \`${database.replace(/`/g, '``')}\`.* TO ${account};`;
}

/** `CURRENT_USER()` 값(`user@host`)을 SQL 계정 표기(`'user'@'host'`)로 바꿉니다. */
export function formatAccount(currentUser: string): string {
  const at = currentUser.lastIndexOf('@');
  const user = at >= 0 ? currentUser.slice(0, at) : currentUser;
  const host = at >= 0 ? currentUser.slice(at + 1) : '<host>';
  const quote = (value: string) => `'${value.replace(/'/g, "''")}'`;
  return `${quote(user)}@${quote(host)}`;
}

interface ParsedGrant {
  privileges: Set<string>;
  /** undefined면 전역(*.*) */
  databasePattern?: string;
}

const ROLE_GRANT = /^GRANT\s+`[^`]+`(?:@`[^`]*`)?\s+TO\s/i;

/**
 * SHOW GRANTS 한 줄에서 DB 단위·전역 권한을 읽습니다.
 * 테이블·컬럼·루틴 단위, PROXY, role 부여는 대상이 아니므로 undefined를 돌려줍니다.
 */
export function parseGrant(line: string): ParsedGrant | undefined {
  const match =
    /^GRANT\s+(.+?)\s+ON\s+(\*|`(?:[^`]|``)+`)\.(\*|`(?:[^`]|``)+`)\s+TO\s/i.exec(
      line,
    );
  if (!match || /\bON\s+(FUNCTION|PROCEDURE|PACKAGE)\b/i.test(line)) {
    return undefined;
  }
  const [, privilegeText, databasePart, tablePart] = match;
  if (tablePart !== '*' || /^PROXY$/i.test(privilegeText.trim())) {
    return undefined;
  }

  const privileges = new Set(
    privilegeText
      .replace(/\([^)]*\)/g, '')
      .split(',')
      .map((privilege) => privilege.trim().toUpperCase().replace(/\s+/g, ' '))
      .filter((privilege) => privilege.length > 0)
      .map((privilege) => (privilege === 'ALL PRIVILEGES' ? 'ALL' : privilege)),
  );

  return databasePart === '*'
    ? { privileges }
    : {
        privileges,
        databasePattern: databasePart.slice(1, -1).replace(/``/g, '`'),
      };
}

/** DB 단위 grant의 이름 패턴(`%`, `_` 와일드카드, `\_`·`\%` 이스케이프)과 DB 이름을 비교합니다. */
export function matchesDatabasePattern(
  pattern: string,
  database: string,
): boolean {
  let regex = '';
  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index];
    if (char === '\\' && index + 1 < pattern.length) {
      index += 1;
      regex += escapeRegex(pattern[index]);
    } else if (char === '%') {
      regex += '.*';
    } else if (char === '_') {
      regex += '.';
    } else {
      regex += escapeRegex(char);
    }
  }
  return new RegExp(`^${regex}$`).test(database);
}

/** SHOW GRANTS 결과로 대상 DB에서 migration을 실행할 수 있는지 평가합니다. */
export function evaluatePrivileges(
  grants: readonly string[],
  database: string,
): PrivilegeReport {
  const effective = new Set<string>();
  let determinate = grants.length > 0;

  for (const line of grants) {
    if (ROLE_GRANT.test(line)) {
      determinate = false;
      continue;
    }
    const grant = parseGrant(line);
    if (
      !grant ||
      (grant.databasePattern !== undefined &&
        !matchesDatabasePattern(grant.databasePattern, database))
    ) {
      continue;
    }
    grant.privileges.forEach((privilege) => effective.add(privilege));
  }

  const all = effective.has('ALL');
  const has = (privilege: string) => all || effective.has(privilege);
  return {
    database,
    effective: all
      ? ['ALL PRIVILEGES']
      : [...effective].filter((privilege) => privilege !== 'USAGE').sort(),
    missingForMigrations: MIGRATION_PRIVILEGES.filter(
      (privilege) => !has(privilege),
    ),
    canCreateDatabase: has('CREATE'),
    determinate,
  };
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
    return `'${user}' lacks privileges on \`${target.database}\`. Ask a DB admin to run:\n  ${grantSqlFor(formatAccount(`${user}@<host>`), target.database)}`;
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

const SYSTEM_DATABASES = new Set([
  'information_schema',
  'performance_schema',
  'mysql',
  'sys',
]);

async function readGrants(connection: AdminConnection): Promise<string[]> {
  const rows = await connection.query('SHOW GRANTS FOR CURRENT_USER()');
  return rows
    .map((row) => stringValue(Object.values(row)[0]))
    .filter((grant) => grant.length > 0)
    .map(redactGrant);
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
