import { config } from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

process.env.NODE_ENV = 'test';

const environmentFile = resolve(process.cwd(), '.env.test.local');
if (!existsSync(environmentFile)) {
  throw new Error(
    'Missing .env.test.local. Copy .env.test.example and enter dedicated test database credentials.',
  );
}

const result = config({ path: environmentFile });
if (result.error) {
  throw result.error;
}
