import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
  Req,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiDefaultErrorResponse } from '../../common/http/api-contract.decorators';
import { successResponse } from '../../common/http/api-response';
import type { RequestWithId } from '../../common/request-id/request-with-id';
import { DictionaryLiveService } from '../application/dictionary-live.service';
import {
  DictionaryConceptQueryDto,
  DictionaryTranslationsQueryDto,
  SearchDictionaryDto,
} from './dictionary.dto';
import { dictionaryRequestId } from './dictionary-http';
import {
  DictionaryConceptSearchResponseDto,
  DictionaryLanguagesResponseDto,
  DictionaryPublicLexemeResponseDto,
  DictionarySearchResponseDto,
} from './dictionary-response.dto';

@ApiTags('dictionary')
@ApiDefaultErrorResponse()
@Controller('api/v1')
export class DictionaryLiveController {
  constructor(private readonly dictionary: DictionaryLiveService) {}

  @Get('languages')
  @ApiOperation({ summary: '지원하는 사전 언어' })
  @ApiOkResponse({ type: DictionaryLanguagesResponseDto })
  async languages(@Req() req: RequestWithId) {
    return successResponse(
      dictionaryRequestId(req),
      await this.dictionary.listLanguages(),
    );
  }

  @Get('lexemes')
  @ApiOperation({ summary: '게시된 어휘 검색' })
  @ApiOkResponse({ type: DictionarySearchResponseDto })
  async search(@Req() req: RequestWithId, @Query() query: SearchDictionaryDto) {
    return successResponse(
      dictionaryRequestId(req),
      await this.dictionary.search(query),
    );
  }

  @Get('lexemes/:id')
  @ApiOperation({ summary: '게시된 어휘 상세' })
  @ApiOkResponse({ type: DictionaryPublicLexemeResponseDto })
  async getLexeme(
    @Req() req: RequestWithId,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return successResponse(
      dictionaryRequestId(req),
      await this.dictionary.getLexeme(id),
    );
  }

  @Get('concepts/:id')
  @ApiOperation({ summary: '게시된 개념과 연결 어휘' })
  @ApiOkResponse({ type: DictionaryConceptSearchResponseDto })
  async concept(
    @Req() req: RequestWithId,
    @Param('id', ParseIntPipe) id: number,
    @Query() query: DictionaryConceptQueryDto,
  ) {
    return successResponse(
      dictionaryRequestId(req),
      await this.dictionary.concept(id, query),
    );
  }

  @Get('concepts/:id/translations')
  @ApiOperation({ summary: '게시된 개념의 다국어 어휘' })
  @ApiOkResponse({ type: DictionaryConceptSearchResponseDto })
  async translations(
    @Req() req: RequestWithId,
    @Param('id', ParseIntPipe) id: number,
    @Query() query: DictionaryTranslationsQueryDto,
  ) {
    return successResponse(
      dictionaryRequestId(req),
      await this.dictionary.translations(id, query),
    );
  }
}
