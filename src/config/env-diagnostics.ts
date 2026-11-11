import { parse } from 'dotenv';
import { existsSync, readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { ENV_FILE_BY_NODE_ENV } from './env-files';

/** env 파일별로 그 파일을 읽는 대표 명령(안내 메시지용) */
const COMMANDS_BY_NODE_ENV: Readonly<Record<string, string>> = {
  development: 'npm run db:check, db:setup, migration:*, start:dev',
  test: 'npm run db:check:test, db:setup:test, test:e2e',
  production: 'npm run env:check:prod, db:check:prod, migration:*:prod',
};

export interface EnvErrorContext {
  /** 이번 실행이 읽은 env 파일(절대 또는 상대 경로) */
  envFile: string;
  nodeEnv: string;
  cwd?: string;
}

/**
 * 설정 검증 오류에 "어느 파일을, 어떤 NODE_ENV로 읽었는지"를 덧붙입니다.
 *
 * `X is required.` 형태인데 다른 환경의 env 파일에는 X가 값과 함께 있으면, 명령과 파일이
 * 어긋났을 가능성이 높으므로 힌트를 덧붙입니다. 예: `.env.test.local`에 비밀번호를 넣고 Dev 명령
 * `npm run db:check`(`.env`를 읽음)를 실행한 경우.
 *
 * 다른 파일은 키가 있는지만 확인하고, 값은 출력하지 않습니다.
 */
export function explainEnvError(
  error: unknown,
  context: EnvErrorContext,
): string {
  const message = error instanceof Error ? error.message : String(error);
  const cwd = context.cwd ?? process.cwd();
  const envFile = resolve(cwd, context.envFile);
  const shownFile = displayPath(cwd, envFile);
  const found = existsSync(envFile) ? '' : ', not found';

  const lines = [
    `${message} (env file: ${shownFile}${found}, NODE_ENV=${context.nodeEnv})`,
  ];

  const missingKey = /^([A-Z][A-Z0-9_]*) is required/.exec(message)?.[1];
  if (missingKey) {
    for (const [nodeEnv, fileName] of Object.entries(ENV_FILE_BY_NODE_ENV)) {
      const candidate = resolve(cwd, fileName);
      if (candidate === envFile || !hasValue(candidate, missingKey)) {
        continue;
      }
      // 같은 NODE_ENV인데 다른 파일을 읽었다면 ENV_FILE이 기본 파일을 대신한 경우입니다.
      lines.push(
        nodeEnv === context.nodeEnv
          ? `Hint: ${fileName} has ${missingKey}, but ENV_FILE replaced it with ${shownFile} for this run.`
          : `Hint: ${fileName} has ${missingKey}, but that file is read only with NODE_ENV=${nodeEnv} (${COMMANDS_BY_NODE_ENV[nodeEnv]}). This command read ${shownFile}.`,
      );
    }
  }

  return lines.join('\n');
}

function hasValue(filePath: string, key: string): boolean {
  if (!existsSync(filePath)) {
    return false;
  }
  try {
    const value = parse(readFileSync(filePath))[key];
    return typeof value === 'string' && value.trim().length > 0;
  } catch {
    return false;
  }
}

function displayPath(cwd: string, filePath: string): string {
  const relativePath = relative(cwd, filePath);
  return relativePath && !relativePath.startsWith('..')
    ? relativePath
    : filePath;
}
