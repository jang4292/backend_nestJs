import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import { DataSource } from 'typeorm';
import { AppService } from './app.service';

export interface HealthResponse {
  status: 'ok' | 'degraded';
  timestamp: string;
  database: 'up' | 'down';
}

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

  /**
   * 로드밸런서/배포 스크립트용 상태 확인. DB에 연결할 수 없으면 503을 반환해
   * `curl -fsS /health`가 실패하도록 합니다. 모니터링 polling이 요청 제한에 걸리지 않게 제외합니다.
   */
  @Get('health')
  @SkipThrottle()
  @ApiOperation({ summary: '애플리케이션 및 데이터베이스 상태 확인' })
  async getHealth(
    @Res({ passthrough: true }) res?: Response,
  ): Promise<HealthResponse> {
    let database: HealthResponse['database'] = 'down';

    try {
      await this.dataSource.query('SELECT 1');
      database = 'up';
    } catch {
      database = 'down';
    }

    if (database === 'down') {
      res?.status(HttpStatus.SERVICE_UNAVAILABLE);
    }

    return {
      status: database === 'up' ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      database,
    };
  }
}
