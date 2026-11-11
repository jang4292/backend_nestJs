import { config } from 'dotenv';
import { DataSource } from 'typeorm';
import { validateAppEnv } from '../config/app-env';
import {
  assertEnvFileAvailable,
  resolveEnvFilePath,
} from '../config/env-files';
import { cliDatabaseConfig, createDatabaseOptions } from './database-options';

// 앱과 같은 규칙으로 env 파일을 고릅니다(NODE_ENV별, ENV_FILE 우선).
const envFilePath = resolveEnvFilePath();
assertEnvFileAvailable(envFilePath);
config({ path: envFilePath, quiet: true });

// ts-node(src/*.ts)와 빌드 결과(dist/*.js) 양쪽에서 같은 data-source를 씁니다.
const dataSource = new DataSource(
  createDatabaseOptions(cliDatabaseConfig(validateAppEnv(process.env))),
);

export default dataSource;
