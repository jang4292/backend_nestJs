import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import { DataSource } from 'typeorm';
import { ApiDefaultErrorResponse } from './common/http/api-contract.decorators';
import { AppService } from './app.service';

export class HealthResponse {
  @ApiProperty({ enum: ['ok', 'degraded'] })
  status!: 'ok' | 'degraded';

  @ApiProperty({ type: String, format: 'date-time' })
  timestamp!: string;

  @ApiProperty({ enum: ['up', 'down'] })
  database!: 'up' | 'down';
}

@Controller()
@ApiTags('system')
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly dataSource: DataSource,
  ) {}

  @Get()
  @ApiOperation({ summary: '애플리케이션 환영 메시지' })
  @ApiOkResponse({ type: String })
  @ApiDefaultErrorResponse()
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
  @ApiOkResponse({ type: HealthResponse })
  @ApiResponse({
    status: HttpStatus.SERVICE_UNAVAILABLE,
    description: '데이터베이스 연결 상태가 down입니다.',
    type: HealthResponse,
  })
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
