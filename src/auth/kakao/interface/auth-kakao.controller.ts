import {
  Controller,
  Post,
  Body,
  Req,
  HttpCode,
  HttpStatus,
  ValidationPipe,
  UseFilters,
  UseInterceptors,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { successResponse } from '../../../common/http/api-response';
import { RequestIdInterceptor } from '../../../common/request-id/request-id.interceptor';
import { RequestIdService } from '../../../common/request-id/request-id.service';
import type { RequestWithId } from '../../../common/request-id/request-with-id';
import type { KakaoAccessTokenSet } from '../application/ports/kakao-oauth.port';
import { ExchangeKakaoAuthCodeUseCase } from '../application/use-cases/exchange-kakao-auth-code.use-case';
import { KakaoLoginUseCase } from '../application/use-cases/kakao-login.use-case';
import type { KakaoLoginOutput } from '../application/use-cases/kakao-login.use-case';
import { ExchangeCodeDto } from './dto/exchange-code.dto';
import { KakaoLoginDto } from './dto/kakao-login.dto';
import { KakaoAuthExceptionFilter } from './kakao-auth-exception.filter';
import {
  KakaoAuthError,
  KakaoAuthErrorCode,
} from '../domain/kakao-auth.errors';

type KakaoLoginResponseData = {
  accessToken: string;
  expiresIn?: number;
  user: {
    id: number;
    username: string;
    email?: string | null;
  };
};

@Controller('auth/kakao')
@ApiTags('auth/kakao')
@UseInterceptors(RequestIdInterceptor)
@UseFilters(KakaoAuthExceptionFilter)
export class AuthKakaoController {
  constructor(
    private readonly exchangeCodeUseCase: ExchangeKakaoAuthCodeUseCase,
    private readonly kakaoLoginUseCase: KakaoLoginUseCase,
    private readonly requestIdService: RequestIdService,
  ) {}

  private getRequestId(req: RequestWithId): string {
    return req.requestId ?? this.requestIdService.resolve(req);
  }

  private static toKakaoAuthError(err: unknown): KakaoAuthError {
    if (err instanceof KakaoAuthError) return err;
    return new KakaoAuthError(
      KakaoAuthErrorCode.AUTH_KAKAO_INTERNAL_ERROR,
      err instanceof Error ? err.message : String(err),
    );
  }

  @Post('exchange-code')
  @ApiOperation({ summary: 'Kakao authorization code 교환' })
  @HttpCode(HttpStatus.OK)
  async exchangeCode(
    @Body(ValidationPipe) dto: ExchangeCodeDto,
    @Req() req: RequestWithId,
  ) {
    const requestId = this.getRequestId(req);
    let tokenSet: KakaoAccessTokenSet;
    try {
      tokenSet = await this.exchangeCodeUseCase.execute({
        code: dto.code,
        redirectUri: dto.redirectUri,
        state: dto.state,
        expectedState: dto.expectedState,
      });
    } catch (err) {
      throw AuthKakaoController.toKakaoAuthError(err);
    }
    return successResponse(requestId, tokenSet);
  }

  @Post('login')
  @ApiOperation({ summary: 'Kakao social login' })
  @HttpCode(HttpStatus.OK)
  async login(
    @Body(ValidationPipe) dto: KakaoLoginDto,
    @Req() req: RequestWithId,
  ) {
    const requestId = this.getRequestId(req);
    let result: KakaoLoginOutput;
    try {
      result = await this.kakaoLoginUseCase.execute({
        accessToken: dto.accessToken,
        code: dto.code,
        redirectUri: dto.redirectUri,
        state: dto.state,
        expectedState: dto.expectedState,
      });
    } catch (err) {
      throw AuthKakaoController.toKakaoAuthError(err);
    }
    const data: KakaoLoginResponseData = {
      accessToken: result.session.accessToken,
      expiresIn: result.session.expiresIn,
      user: {
        id: result.user.id,
        username: result.user.username,
        email: result.user.email,
      },
    };

    return successResponse(requestId, data);
  }
}
