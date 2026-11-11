import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { explainEnvError } from './env-diagnostics';

describe('explainEnvError', () => {
  let cwd: string;

  beforeEach(() => {
    cwd = mkdtempSync(join(tmpdir(), 'env-diagnostics-'));
  });

  afterEach(() => {
    rmSync(cwd, { recursive: true, force: true });
  });

  it('adds the env file and NODE_ENV that were used', () => {
    writeFileSync(join(cwd, '.env'), 'DB_PASSWORD=\n');

    expect(
      explainEnvError(new Error('DB_PASSWORD is required.'), {
        envFile: '.env',
        nodeEnv: 'development',
        cwd,
      }),
    ).toBe('DB_PASSWORD is required. (env file: .env, NODE_ENV=development)');
  });

  it('hints when another environment file has the missing key, without printing its value', () => {
    writeFileSync(join(cwd, '.env'), 'DB_PASSWORD=\n');
    writeFileSync(join(cwd, '.env.test.local'), 'DB_PASSWORD=s3cr3t-value\n');

    const message = explainEnvError(new Error('DB_PASSWORD is required.'), {
      envFile: '.env',
      nodeEnv: 'development',
      cwd,
    });

    expect(message).toContain(
      'Hint: .env.test.local has DB_PASSWORD, but that file is read only with NODE_ENV=test (npm run db:check:test, db:setup:test, test:e2e). This command read .env.',
    );
    expect(message).not.toContain('s3cr3t-value');
  });

  it('explains ENV_FILE overrides of the default file for the same NODE_ENV', () => {
    writeFileSync(join(cwd, '.env'), 'DB_PASSWORD=from-default-file\n');
    writeFileSync(join(cwd, 'custom.env'), 'DB_PASSWORD=\n');

    const message = explainEnvError(new Error('DB_PASSWORD is required.'), {
      envFile: 'custom.env',
      nodeEnv: 'development',
      cwd,
    });

    expect(message).toContain(
      'Hint: .env has DB_PASSWORD, but ENV_FILE replaced it with custom.env for this run.',
    );
    expect(message).not.toContain('from-default-file');
  });

  it('ignores other files where the key is empty or missing', () => {
    writeFileSync(join(cwd, '.env.test.local'), 'DB_PASSWORD=   \n');
    writeFileSync(join(cwd, '.env.production'), 'DB_USERNAME=app\n');

    expect(
      explainEnvError(new Error('DB_PASSWORD is required.'), {
        envFile: '.env',
        nodeEnv: 'development',
        cwd,
      }),
    ).toBe(
      'DB_PASSWORD is required. (env file: .env, not found, NODE_ENV=development)',
    );
  });

  it('does not add hints for other validation errors', () => {
    writeFileSync(join(cwd, '.env.production'), 'JWT_SECRET=x\n');

    expect(
      explainEnvError(
        new Error('DB_DATABASE must end with _test when NODE_ENV=test.'),
        { envFile: '.env.test.local', nodeEnv: 'test', cwd },
      ),
    ).toBe(
      'DB_DATABASE must end with _test when NODE_ENV=test. (env file: .env.test.local, not found, NODE_ENV=test)',
    );
  });

  it('shows absolute paths for files outside the working directory', () => {
    const outside = join(tmpdir(), 'elsewhere.env');

    expect(
      explainEnvError('JWT_SECRET is required.', {
        envFile: outside,
        nodeEnv: 'production',
        cwd,
      }),
    ).toContain(`(env file: ${outside}, not found, NODE_ENV=production)`);
  });
});
