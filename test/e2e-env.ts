import { config } from 'dotenv';
import {
  assertEnvFileAvailable,
  resolveEnvFilePath,
} from '../src/config/env-files';

// e2e는 항상 test 환경(.env.test.local, *_test DB)으로 실행합니다.
process.env.NODE_ENV = 'test';

const environmentFile = resolveEnvFilePath();
assertEnvFileAvailable(environmentFile);

const result = config({ path: environmentFile, quiet: true });
if (result.error) {
  throw result.error;
}
