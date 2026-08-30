import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const mockDataSource = {
      query: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
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
      const result = await appController.getHealth();
      expect(result).toHaveProperty('status', 'ok');
      expect(result).toHaveProperty('database', 'up');
      expect(result).toHaveProperty('timestamp');
    });
  });
});
