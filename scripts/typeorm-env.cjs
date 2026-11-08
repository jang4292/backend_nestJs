#!/usr/bin/env node
'use strict';

/**
 * 환경별 TypeORM migration 실행 래퍼(macOS/Linux/Windows PowerShell 공통).
 *
 *   node scripts/typeorm-env.cjs <development|test|production> <migration:show|migration:run|migration:revert> [--dist]
 *
 * - NODE_ENV를 지정한 뒤 data-source를 실행하므로, 앱과 같은 env 파일을 읽습니다.
 *   (development → .env, test → .env.test.local, production → .env.production, ENV_FILE로 재지정 가능)
 * - --dist: 빌드 결과(dist/database/data-source.js)를 node로 실행합니다. 운영 서버에서 ts-node와
 *   src 없이 migration을 실행할 때 사용하며, 먼저 `npm run build`가 필요합니다.
 */
const { spawnSync } = require('node:child_process');
const { existsSync } = require('node:fs');
const path = require('node:path');

const ENVIRONMENTS = ['development', 'test', 'production'];
const COMMANDS = ['migration:show', 'migration:run', 'migration:revert'];

function main(argv) {
  const [environment, command, ...rest] = argv;
  const useDist = rest.includes('--dist');

  if (!ENVIRONMENTS.includes(environment) || !COMMANDS.includes(command)) {
    process.stderr.write(
      `Usage: node scripts/typeorm-env.cjs <${ENVIRONMENTS.join('|')}> <${COMMANDS.join('|')}> [--dist]\n`,
    );
    return 2;
  }

  const root = path.resolve(__dirname, '..');
  const typeormCli = path.join(root, 'node_modules', 'typeorm', 'cli.js');
  const dataSource = useDist
    ? path.join(root, 'dist', 'database', 'data-source.js')
    : path.join(root, 'src', 'database', 'data-source.ts');

  if (useDist && !existsSync(dataSource)) {
    process.stderr.write(
      'dist/database/data-source.js not found. Run `npm run build` first.\n',
    );
    return 1;
  }

  const nodeArgs = useDist ? [] : ['--require', 'ts-node/register'];
  const result = spawnSync(
    process.execPath,
    [...nodeArgs, typeormCli, command, '-d', dataSource],
    {
      cwd: root,
      stdio: 'inherit',
      env: { ...process.env, NODE_ENV: environment },
    },
  );

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
