import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;
  let mockDataSource: { query: jest.Mock };

  beforeEach(async () => {
    mockDataSource = {
      query: jest.fn().mockResolvedValue([{ 1: 1 }]),
    };

    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return welcome message', () => {
      expect(appController.getHello()).toBe('Welcome to NestJS Backend API!');
    });
  });

  describe('health', () => {
    it('should return health status', async () => {
      const res = { status: jest.fn() };
      const result = await appController.getHealth(res as never);
      expect(result).toHaveProperty('status', 'ok');
      expect(result).toHaveProperty('database', 'up');
      expect(result).toHaveProperty('timestamp');
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should return 503 and degraded status when the database is down', async () => {
      mockDataSource.query.mockRejectedValueOnce(new Error('ECONNREFUSED'));
      const res = { status: jest.fn() };

      const result = await appController.getHealth(res as never);

      expect(res.status).toHaveBeenCalledWith(503);
      expect(result).toMatchObject({ status: 'degraded', database: 'down' });
    });
  });
});
