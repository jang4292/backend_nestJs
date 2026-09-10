import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { DataSource } from 'typeorm';
import { AppService } from './app.service';

@Controller()
@ApiTags('system')
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly dataSource: DataSource,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  @ApiOperation({ summary: '애플리케이션 및 데이터베이스 상태 확인' })
  async getHealth() {
    let database: 'up' | 'down' = 'down';

    try {
      await this.dataSource.query('SELECT 1');
      database = 'up';
    } catch {
      database = 'down';
    }

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      database,
    };
  }
}
