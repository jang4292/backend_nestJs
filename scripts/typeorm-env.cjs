#!/usr/bin/env node
'use strict';

/**
 * 환경별 DB·migration 명령 실행 래퍼(macOS/Linux/Windows PowerShell 공통).
 *
 *   node scripts/typeorm-env.cjs <development|test|production> <command> [--dist] [options]
 *
 * command
 *   migration:show | migration:run | migration:revert   TypeORM CLI
 *   migration:check    entity와 migration의 차이(drift) 검사. 파일을 만들지 않고, 차이가 있으면 종료 코드 1
 *   db:check           읽기 전용 연결·상태 점검 (src/database/cli/db-tool.ts, --strict 지원)
 *   db:ensure          대상 DB가 없으면 생성 (dev/test 전용)
 *   db:reset           *_test DB를 비우고 다시 생성 (test 전용)
 *
 * - NODE_ENV를 지정한 뒤 실행하므로 앱과 같은 env 파일을 읽습니다.
 *   (development → .env, test → .env.test.local, production → .env.production, ENV_FILE로 재지정 가능)
 * - --dist: 빌드 결과(dist/…)를 node로 실행합니다. 운영 서버에서 ts-node와 src 없이 실행할 때 사용하며,
 *   먼저 `npm run build`가 필요합니다.
 */
const { spawnSync } = require('node:child_process');
const { existsSync } = require('node:fs');
const path = require('node:path');

const ENVIRONMENTS = ['development', 'test', 'production'];
const TYPEORM_COMMANDS = ['migration:show', 'migration:run', 'migration:revert'];
const DB_COMMANDS = ['db:check', 'db:ensure', 'db:reset'];
const COMMANDS = [...TYPEORM_COMMANDS, 'migration:check', ...DB_COMMANDS];

function main(argv) {
  const [environment, command, ...rest] = argv;
  const useDist = rest.includes('--dist');
  const passThrough = rest.filter((arg) => arg !== '--dist');

  if (!ENVIRONMENTS.includes(environment) || !COMMANDS.includes(command)) {
    process.stderr.write(
      `Usage: node scripts/typeorm-env.cjs <${ENVIRONMENTS.join('|')}> <${COMMANDS.join('|')}> [--dist]\n`,
    );
    return 2;
  }

  const root = path.resolve(__dirname, '..');
  const base = useDist ? path.join(root, 'dist') : path.join(root, 'src');
  const ext = useDist ? 'js' : 'ts';
  const dataSource = path.join(base, 'database', `data-source.${ext}`);
  const dbTool = path.join(base, 'database', 'cli', `db-tool.${ext}`);
  const typeormCli = path.join(root, 'node_modules', 'typeorm', 'cli.js');

  if (useDist && !existsSync(dataSource)) {
    process.stderr.write(
      `${path.relative(root, dataSource)} not found. Run \`npm run build\` first.\n`,
    );
    return 1;
  }

  let args;
  if (DB_COMMANDS.includes(command)) {
    args = [dbTool, command.slice('db:'.length), ...passThrough];
  } else if (command === 'migration:check') {
    // --check 모드는 파일을 쓰지 않습니다. 경로는 형식상 필요한 값입니다.
    const draftPath = path.join(root, 'src', 'database', 'migrations', 'SchemaDriftCheck');
    args = [typeormCli, 'migration:generate', draftPath, '-d', dataSource, '--check'];
  } else {
    args = [typeormCli, command, '-d', dataSource, ...passThrough];
  }

  const nodeArgs = useDist ? [] : ['--require', 'ts-node/register'];
  const result = spawnSync(process.execPath, [...nodeArgs, ...args], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: environment },
  });

  if (result.error) {
    process.stderr.write(`${result.error.message}\n`);
    return 1;
  }
  return result.status ?? 1;
}

if (require.main === module) {
  process.exitCode = main(process.argv.slice(2));
}

module.exports = { main };
