import {
  Controller,
  Get,
  Req,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { DataSource } from 'typeorm';
import { ApiDefaultErrorResponse } from '../../common/http/api-contract.decorators';
import { successResponse } from '../../common/http/api-response';
import type { RequestWithId } from '../../common/request-id/request-with-id';
import { dictionaryRequestId } from './dictionary-http';
import { DictionaryHealthResponseDto } from './dictionary-response.dto';

@ApiTags('system')
@ApiDefaultErrorResponse()
@SkipThrottle()
@Controller('api/v1/health')
export class DictionaryHealthController {
  constructor(private readonly dataSource: DataSource) {}

  @Get('live')
  @ApiOperation({ summary: '프로세스 생존 확인' })
  @ApiOkResponse({ type: DictionaryHealthResponseDto })
  live(@Req() req: RequestWithId) {
    return successResponse(dictionaryRequestId(req), { status: 'ok' });
  }

  @Get('ready')
  @ApiOperation({ summary: '데이터베이스 연결 준비 상태 확인' })
  @ApiOkResponse({ type: DictionaryHealthResponseDto })
  async ready(@Req() req: RequestWithId) {
    try {
      await this.dataSource.query('SELECT 1');
    } catch (error) {
      throw new ServiceUnavailableException('Database is unavailable', {
        cause: error,
      });
    }
    return successResponse(dictionaryRequestId(req), { status: 'ok' });
  }
}
