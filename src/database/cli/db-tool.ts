/**
 * DB 관리 CLI. 보통 `scripts/typeorm-env.cjs`를 거쳐 npm script로 실행합니다.
 *
 *   check   읽기 전용. 서버 연결, 계정, TLS, 대상 DB 존재, 테이블 수, pending migration, 권한을 출력
 *   ensure  대상 DB가 없으면 utf8mb4로 생성(dev/test 전용). 테이블은 이어서 migration:run이 만듭니다.
 *   reset   test 전용. *_test DB를 비우고 다시 생성(빈 DB에서 migration 전체 체인 검증용)
 *
 * 옵션: --strict (check에서 DB가 없거나, migration 권한이 부족하거나, pending migration이 있으면 종료 코드 1)
 *
 * env 파일은 앱과 같은 규칙(src/config/env-files.ts)으로 읽고, 비밀번호는 출력하지 않습니다.
 */
import { config } from 'dotenv';
import { createConnection } from 'mysql2/promise';
import { relative } from 'node:path';
import { DataSource, MigrationExecutor } from 'typeorm';
import {
  validateAppEnv,
  type AppEnv,
  type NodeEnvironment,
} from '../../config/app-env';
import { explainEnvError } from '../../config/env-diagnostics';
import {
  assertEnvFileAvailable,
  resolveEnvFilePath,
} from '../../config/env-files';
import {
  assertEnsureAllowed,
  assertResetAllowed,
  DatabaseAdminError,
  describeDatabaseError,
  ensureDatabase,
  formatAccount,
  grantSqlFor,
  inspectDatabase,
  resetTestDatabase,
  resolveDatabaseTarget,
  type AdminConnection,
  type DatabaseStatus,
  type DatabaseTarget,
  type ServerTarget,
} from '../database-admin';
import { cliDatabaseConfig, createDatabaseOptions } from '../database-options';

const COMMANDS = ['check', 'ensure', 'reset'] as const;
type Command = (typeof COMMANDS)[number];

/** 안내 메시지에 쓰는 환경별 npm script 접미사 */
const SCRIPT_SUFFIX: Record<NodeEnvironment, string> = {
  development: '',
  test: ':test',
  production: ':prod',
};

function write(line = ''): void {
  process.stdout.write(`${line}\n`);
}

function fail(message: string): number {
  process.stderr.write(`FAIL ${message}\n`);
  return 1;
}

function isCommand(value: string | undefined): value is Command {
  return COMMANDS.includes(value as Command);
}

async function connectServer(server: ServerTarget): Promise<AdminConnection> {
  const connection = await createConnection({
    host: server.host,
    port: server.port,
    user: server.user,
    password: server.password,
    ...(server.ssl ? { ssl: server.ssl } : {}),
    ...(server.connectTimeout ? { connectTimeout: server.connectTimeout } : {}),
  });
  return {
    async query(sql, params) {
      const [rows] = await connection.query(sql, params);
      return Array.isArray(rows) ? (rows as Record<string, unknown>[]) : [];
    },
    end: () => connection.end(),
  };
}

async function readMigrationState(
  env: AppEnv,
): Promise<{ total: number; applied: number; pending: string[] }> {
  const dataSource = new DataSource(
    createDatabaseOptions(cliDatabaseConfig(env)),
  );
  await dataSource.initialize();
  try {
    // getExecutedMigrations/getPendingMigrations는 migrations 테이블이 없으면 빈 목록을 돌려주며 아무것도 쓰지 않습니다.
    const executor = new MigrationExecutor(dataSource);
    const executed = await executor.getExecutedMigrations();
    const pending = await executor.getPendingMigrations();
    return {
      total: dataSource.migrations.length,
      applied: executed.length,
      pending: pending.map((migration) => migration.name),
    };
  } finally {
    await dataSource.destroy();
  }
}

async function runCheck(
  connection: AdminConnection,
  env: AppEnv,
  target: DatabaseTarget,
  strict: boolean,
): Promise<number> {
  const suffix = SCRIPT_SUFFIX[env.NODE_ENV];
  const status = await inspectDatabase(connection, target.database);

  write(`OK  connected as ${status.currentUser}`);
  write(`    server   : MariaDB ${status.serverVersion}`);
  write(
    `    tls      : ${status.tlsCipher ?? 'off (credentials and data are sent in plaintext)'}`,
  );

  const privilegesOk = printPrivileges(status);

  if (!status.database.exists) {
    write(
      `    database : ${target.database} — missing (or not visible to this account)`,
    );
    write(
      `    visible  : ${status.visibleDatabases.length > 0 ? status.visibleDatabases.join(', ') : '(none)'}`,
    );
    printGrants(status.grants);
    write();
    if (!privilegesOk) {
      write(
        `Next: ask a DB admin to run the GRANT above, then npm run db:setup${suffix}`,
      );
    } else {
      write(
        env.NODE_ENV === 'production'
          ? 'Next: create it with the admin SQL in docs/deployment/database-environments.kr.md (4.1), then npm run migration:run:prod'
          : `Next: npm run db:setup${suffix}   # creates the database, then runs migrations`,
      );
    }
    return strict ? 1 : 0;
  }

  write(
    `    database : ${target.database} (${status.database.charset}/${status.database.collation}, ${status.database.tableCount} tables)`,
  );
  if (status.database.charset !== 'utf8mb4') {
    write('    warning  : database charset is not utf8mb4');
  }

  const migrations = await readMigrationState(env);
  write(
    `    migration: ${migrations.applied} applied, ${migrations.pending.length} pending (${migrations.total} in this build)`,
  );
  for (const name of migrations.pending) {
    write(`      [ ] ${name}`);
  }
  printGrants(status.grants);

  if (!privilegesOk) {
    write();
    write(
      `Next: ask a DB admin to run the GRANT above, then ${env.NODE_ENV === 'production' ? 'npm run migration:run:prod' : `npm run db:setup${suffix}`}`,
    );
    return strict ? 1 : 0;
  }
  if (migrations.pending.length > 0) {
    write();
    write(`Next: npm run migration:run${suffix}`);
    return strict ? 1 : 0;
  }
  return 0;
}

/** 대상 DB 기준 권한 판정을 출력합니다. migration을 실행할 수 있으면 true */
function printPrivileges(status: DatabaseStatus): boolean {
  const { privileges } = status;
  const target = `\`${privileges.database}\``;
  if (!privileges.determinate) {
    write(
      `    privilege: could not be determined from SHOW GRANTS (roles?) — check the grants below`,
    );
    return true;
  }
  if (privileges.missingForMigrations.length === 0) {
    write(`    privilege: ok for migrations on ${target}`);
    return true;
  }
  write(
    `    privilege: missing ${privileges.missingForMigrations.join(', ')} on ${target} — migrations would fail midway`,
  );
  write(
    `      fix (DB admin): ${grantSqlFor(formatAccount(status.currentUser), privileges.database, privileges.missingForMigrations)}`,
  );
  return false;
}

function printGrants(grants: string[]): void {
  write('    grants   :');
  for (const grant of grants) {
    write(`      ${grant}`);
  }
}

export async function main(argv: string[]): Promise<number> {
  const [command, ...options] = argv;
  if (!isCommand(command)) {
    process.stderr.write(`Usage: db-tool <${COMMANDS.join('|')}> [--strict]\n`);
    return 2;
  }

  let env: AppEnv;
  const envFile = resolveEnvFilePath();
  try {
    assertEnvFileAvailable(envFile);
    config({ path: envFile, quiet: true });
    env = validateAppEnv(process.env);
  } catch (error) {
    // 어느 파일을 어떤 NODE_ENV로 읽었는지, 다른 env 파일에 그 키가 있는지 함께 알려 줍니다.
    return fail(
      explainEnvError(error, {
        envFile,
        nodeEnv: process.env.NODE_ENV?.trim() || 'development',
      }),
    );
  }

  const target = resolveDatabaseTarget(env);
  const relativeFile = relative(process.cwd(), envFile);
  const shownFile =
    relativeFile && !relativeFile.startsWith('..') ? relativeFile : envFile;
  write(
    `db:${command}  NODE_ENV=${env.NODE_ENV}  env=${shownFile}  ${target.server.user}@${target.server.host}:${target.server.port}/${target.database}`,
  );

  let connection: AdminConnection | undefined;
  try {
    // 허용되지 않는 명령은 서버에 연결하기 전에 거부합니다.
    if (command === 'ensure') {
      assertEnsureAllowed(target.database, env.NODE_ENV);
    } else if (command === 'reset') {
      assertResetAllowed(target.database, env.NODE_ENV);
    }

    connection = await connectServer(target.server);

    if (command === 'check') {
      return await runCheck(
        connection,
        env,
        target,
        options.includes('--strict'),
      );
    }

    if (command === 'ensure') {
      const { created } = await ensureDatabase(
        connection,
        target.database,
        env.NODE_ENV,
      );
      write(
        created
          ? `OK  created database ${target.database} (utf8mb4/utf8mb4_unicode_ci)`
          : `OK  database ${target.database} already exists`,
      );
      return 0;
    }

    await resetTestDatabase(connection, target.database, env.NODE_ENV);
    write(`OK  dropped and recreated ${target.database}`);
    return 0;
  } catch (error) {
    return fail(
      error instanceof DatabaseAdminError
        ? error.message
        : describeDatabaseError(error, target),
    );
  } finally {
    await connection?.end().catch(() => undefined);
  }
}

if (require.main === module) {
  void main(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  });
}
