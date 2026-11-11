import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, MigrationExecutor } from 'typeorm';
import { MigrationStatusService } from './migration-status.service';

describe('MigrationStatusService', () => {
  // MigrationExecutor 생성자가 읽는 최소한의 DataSource 형태
  const dataSource = {
    isInitialized: true,
    options: {},
    driver: {
      options: {},
      database: 'app_db',
      buildTableName: (name: string) => name,
    },
  } as unknown as DataSource;

  function createService(nodeEnv: string) {
    const configService = {
      get: jest.fn().mockReturnValue(nodeEnv),
    } as unknown as ConfigService;
    return new MigrationStatusService(dataSource, configService);
  }

  function mockPending(names: string[]) {
    return jest
      .spyOn(MigrationExecutor.prototype, 'getPendingMigrations')
      .mockResolvedValue(names.map((name) => ({ name }) as never));
  }

  let warn: jest.SpyInstance;
  let error: jest.SpyInstance;

  beforeEach(() => {
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    error = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'debug').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('stays silent when the schema is up to date', async () => {
    mockPending([]);

    await createService('development').onApplicationBootstrap();

    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });

  it('warns with the pending names and the command in development', async () => {
    mockPending(['AddRoleToUsers1765000000000']);

    await createService('development').onApplicationBootstrap();

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('AddRoleToUsers1765000000000'),
    );
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('npm run migration:run`'),
    );
  });

  it('logs an error with the prod command in production', async () => {
    mockPending(['AddRoleToUsers1765000000000']);

    await createService('production').onApplicationBootstrap();

    expect(error).toHaveBeenCalledWith(
      expect.stringContaining('npm run migration:run:prod'),
    );
    expect(warn).not.toHaveBeenCalled();
  });

  it('does not block startup when the check fails', async () => {
    jest
      .spyOn(MigrationExecutor.prototype, 'getPendingMigrations')
      .mockRejectedValue(new Error('connection lost'));
    const service = createService('development');

    await expect(service.onApplicationBootstrap()).resolves.toBeUndefined();
    await expect(service.findPendingMigrations()).resolves.toBeUndefined();
    expect(warn).not.toHaveBeenCalled();
  });

  it('skips the check when the data source is not initialized', async () => {
    const spy = mockPending(['X']);
    const service = new MigrationStatusService(
      { isInitialized: false } as unknown as DataSource,
      { get: jest.fn() } as unknown as ConfigService,
    );

    await expect(service.findPendingMigrations()).resolves.toBeUndefined();
    expect(spy).not.toHaveBeenCalled();
  });
});
