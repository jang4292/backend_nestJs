import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { assertEnvFileAvailable, resolveEnvFilePath } from './env-files';

describe('resolveEnvFilePath', () => {
  const cwd = '/srv/app';

  it.each([
    [undefined, '/srv/app/.env'],
    ['development', '/srv/app/.env'],
    ['test', '/srv/app/.env.test.local'],
    ['production', '/srv/app/.env.production'],
  ])('maps NODE_ENV=%p to %p', (nodeEnv, expected) => {
    expect(resolveEnvFilePath({ NODE_ENV: nodeEnv }, cwd)).toBe(expected);
  });

  it('falls back to .env for an unknown NODE_ENV (validateAppEnv rejects it later)', () => {
    expect(resolveEnvFilePath({ NODE_ENV: 'staging' }, cwd)).toBe(
      '/srv/app/.env',
    );
  });

  it('prefers ENV_FILE (relative to cwd or absolute)', () => {
    expect(
      resolveEnvFilePath(
        { NODE_ENV: 'production', ENV_FILE: 'config/prod.env' },
        cwd,
      ),
    ).toBe('/srv/app/config/prod.env');
    expect(
      resolveEnvFilePath({ ENV_FILE: '/etc/backend-nestjs/app.env' }, cwd),
    ).toBe('/etc/backend-nestjs/app.env');
  });
});

describe('assertEnvFileAvailable', () => {
  it('requires .env.test.local in the test environment', () => {
    expect(() =>
      assertEnvFileAvailable('/nonexistent/.env.test.local', {
        NODE_ENV: 'test',
      }),
    ).toThrow('Missing .env.test.local');
  });

  it('accepts an existing test env file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'env-files-'));
    const file = join(dir, '.env.test.local');
    writeFileSync(file, 'NODE_ENV=test\n');

    expect(() =>
      assertEnvFileAvailable(file, { NODE_ENV: 'test' }),
    ).not.toThrow();
  });

  it('does not require a file for development or production', () => {
    expect(() =>
      assertEnvFileAvailable('/nonexistent/.env.production', {
        NODE_ENV: 'production',
      }),
    ).not.toThrow();
    expect(() => assertEnvFileAvailable('/nonexistent/.env', {})).not.toThrow();
  });
});
