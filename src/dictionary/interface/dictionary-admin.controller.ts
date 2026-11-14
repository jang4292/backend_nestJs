import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AdminOnly } from '../../auth/session/interface/auth-route.decorators';
import { ApiDefaultErrorResponse } from '../../common/http/api-contract.decorators';
import { successResponse } from '../../common/http/api-response';
import { DictionaryAdminService } from '../application/dictionary-admin.service';
import {
  ApproveDictionaryRevisionDto,
  CreateDictionaryConceptDto,
  CreateDictionaryLexemeDto,
  CreateDictionaryPublicationDto,
  CreateDictionarySourceDto,
  DictionaryPageDto,
  ListDictionaryLexemesDto,
  SubmitDictionaryRevisionDto,
  UpdateDictionaryLexemeDto,
} from './dictionary.dto';
import {
  dictionaryRequestId,
  type DictionaryAdminRequest,
} from './dictionary-http';
import {
  DictionaryAdminLexemePageResponseDto,
  DictionaryAdminLexemeResponseDto,
  DictionaryAuditPageResponseDto,
  DictionaryConceptPageResponseDto,
  DictionaryConceptResponseDto,
  DictionaryPublicationResponseDto,
  DictionaryPublicationStateResponseDto,
  DictionarySourcePageResponseDto,
  DictionarySourceResponseDto,
} from './dictionary-response.dto';

@ApiTags('dictionary-admin')
@ApiDefaultErrorResponse()
@AdminOnly()
@Controller('api/v1/admin')
export class DictionaryAdminController {
  constructor(private readonly dictionary: DictionaryAdminService) {}

  @Post('sources')
  @ApiOperation({ summary: '사전 출처와 라이선스 등록' })
  @ApiCreatedResponse({ type: DictionarySourceResponseDto })
  async createSource(
    @Req() req: DictionaryAdminRequest,
    @Body() dto: CreateDictionarySourceDto,
  ) {
    const requestId = dictionaryRequestId(req);
    return successResponse(
      requestId,
      await this.dictionary.createSource(dto, {
        actorId: req.user.id,
        requestId,
      }),
    );
  }

  @Get('sources')
  @ApiOperation({ summary: '사전 출처 목록' })
  @ApiOkResponse({ type: DictionarySourcePageResponseDto })
  async listSources(
    @Req() req: DictionaryAdminRequest,
    @Query() query: DictionaryPageDto,
  ) {
    return successResponse(
      dictionaryRequestId(req),
      await this.dictionary.listSources(query),
    );
  }

  @Post('concepts')
  @ApiOperation({ summary: '언어 독립 개념 등록' })
  @ApiCreatedResponse({ type: DictionaryConceptResponseDto })
  async createConcept(
    @Req() req: DictionaryAdminRequest,
    @Body() dto: CreateDictionaryConceptDto,
  ) {
    const requestId = dictionaryRequestId(req);
    return successResponse(
      requestId,
      await this.dictionary.createConcept(dto, {
        actorId: req.user.id,
        requestId,
      }),
    );
  }

  @Get('concepts')
  @ApiOperation({ summary: '사전 개념 목록' })
  @ApiOkResponse({ type: DictionaryConceptPageResponseDto })
  async listConcepts(
    @Req() req: DictionaryAdminRequest,
    @Query() query: DictionaryPageDto,
  ) {
    return successResponse(
      dictionaryRequestId(req),
      await this.dictionary.listConcepts(query),
    );
  }

  @Post('lexemes')
  @ApiOperation({ summary: '사전 어휘 초안 생성' })
  @ApiCreatedResponse({ type: DictionaryAdminLexemeResponseDto })
  async createLexeme(
    @Req() req: DictionaryAdminRequest,
    @Body() dto: CreateDictionaryLexemeDto,
  ) {
    const requestId = dictionaryRequestId(req);
    return successResponse(
      requestId,
      await this.dictionary.createLexeme(dto, {
        actorId: req.user.id,
        requestId,
      }),
    );
  }

  @Get('lexemes')
  @ApiOperation({ summary: '관리자 어휘 목록' })
  @ApiOkResponse({ type: DictionaryAdminLexemePageResponseDto })
  async listLexemes(
    @Req() req: DictionaryAdminRequest,
    @Query() query: ListDictionaryLexemesDto,
  ) {
    return successResponse(
      dictionaryRequestId(req),
      await this.dictionary.listLexemes(query),
    );
  }

  @Get('lexemes/:id')
  @ApiOperation({ summary: '관리자 어휘 및 현재 revision 조회' })
  @ApiOkResponse({ type: DictionaryAdminLexemeResponseDto })
  async getLexeme(
    @Req() req: DictionaryAdminRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return successResponse(
      dictionaryRequestId(req),
      await this.dictionary.getLexeme(id),
    );
  }

  @Patch('lexemes/:id')
  @ApiOperation({ summary: '새로운 어휘 초안 revision 생성' })
  @ApiOkResponse({ type: DictionaryAdminLexemeResponseDto })
  async updateLexeme(
    @Req() req: DictionaryAdminRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDictionaryLexemeDto,
  ) {
    const requestId = dictionaryRequestId(req);
    return successResponse(
      requestId,
      await this.dictionary.updateLexeme(id, dto, {
        actorId: req.user.id,
        requestId,
      }),
    );
  }

  @Post('lexemes/:id/submit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '현재 초안을 검수 요청' })
  @ApiOkResponse({ type: DictionaryAdminLexemeResponseDto })
  async submitRevision(
    @Req() req: DictionaryAdminRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SubmitDictionaryRevisionDto,
  ) {
    const requestId = dictionaryRequestId(req);
    return successResponse(
      requestId,
      await this.dictionary.submitRevision(id, dto, {
        actorId: req.user.id,
        requestId,
      }),
    );
  }

  @Post('lexemes/:id/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '검수 중인 revision 승인' })
  @ApiOkResponse({ type: DictionaryAdminLexemeResponseDto })
  async approveRevision(
    @Req() req: DictionaryAdminRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ApproveDictionaryRevisionDto,
  ) {
    const requestId = dictionaryRequestId(req);
    return successResponse(
      requestId,
      await this.dictionary.approveRevision(id, dto, {
        actorId: req.user.id,
        requestId,
      }),
    );
  }

  @Get('publications/current')
  @ApiOperation({ summary: '현재 사전 publication 조회' })
  @ApiOkResponse({ type: DictionaryPublicationStateResponseDto })
  async currentPublication(@Req() req: DictionaryAdminRequest) {
    return successResponse(
      dictionaryRequestId(req),
      await this.dictionary.currentPublication(),
    );
  }

  @Post('publications')
  @ApiOperation({ summary: '승인된 revision의 스냅샷 게시' })
  @ApiCreatedResponse({ type: DictionaryPublicationResponseDto })
  async publish(
    @Req() req: DictionaryAdminRequest,
    @Body() dto: CreateDictionaryPublicationDto,
  ) {
    const requestId = dictionaryRequestId(req);
    return successResponse(
      requestId,
      await this.dictionary.publish(dto, {
        actorId: req.user.id,
        requestId,
      }),
    );
  }

  @Get('audit-logs')
  @ApiOperation({ summary: '사전 관리 감사 기록 조회' })
  @ApiOkResponse({ type: DictionaryAuditPageResponseDto })
  async listAuditLogs(
    @Req() req: DictionaryAdminRequest,
    @Query() query: DictionaryPageDto,
  ) {
    return successResponse(
      dictionaryRequestId(req),
      await this.dictionary.listAuditLogs(query),
    );
  }
}
