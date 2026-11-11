import {
  Controller,
  Post,
  Body,
  Req,
  HttpCode,
  HttpStatus,
  UseFilters,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { successResponse } from '../../../common/http/api-response';
import { RequestIdService } from '../../../common/request-id/request-id.service';
import type { RequestWithId } from '../../../common/request-id/request-with-id';
import type { KakaoAccessTokenSet } from '../application/ports/kakao-oauth.port';
import { ExchangeKakaoAuthCodeUseCase } from '../application/use-cases/exchange-kakao-auth-code.use-case';
import { KakaoLoginUseCase } from '../application/use-cases/kakao-login.use-case';
import type { KakaoLoginOutput } from '../application/use-cases/kakao-login.use-case';
import { ExchangeCodeDto } from './dto/exchange-code.dto';
import { KakaoLoginDto } from './dto/kakao-login.dto';
import { SocialAuthExceptionFilter } from '../../shared/interface/social-auth-exception.filter';
import { SocialProviderRoute } from '../../../common/auth/social-provider-route.decorator';
import { toSocialAuthError } from '../../shared/interface/to-social-auth-error';
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

/** 예상하지 못한 오류(DB 오류 등)는 메시지를 노출하지 않는 INTERNAL_ERROR로 감쌉니다. */
const wrapUnexpected = (cause: unknown) =>
  new KakaoAuthError(
    KakaoAuthErrorCode.AUTH_KAKAO_INTERNAL_ERROR,
    'Unexpected error during Kakao authentication.',
    { cause },
  );

@Controller('auth/kakao')
@ApiTags('auth/kakao')
@UseFilters(SocialAuthExceptionFilter)
@SocialProviderRoute('kakao')
export class AuthKakaoController {
  constructor(
    private readonly exchangeCodeUseCase: ExchangeKakaoAuthCodeUseCase,
    private readonly kakaoLoginUseCase: KakaoLoginUseCase,
    private readonly requestIdService: RequestIdService,
  ) {}

  private getRequestId(req: RequestWithId): string {
    return req.requestId ?? this.requestIdService.resolve(req);
  }

  @Post('exchange-code')
  @ApiOperation({ summary: 'Kakao authorization code 교환' })
  @HttpCode(HttpStatus.OK)
  async exchangeCode(@Body() dto: ExchangeCodeDto, @Req() req: RequestWithId) {
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
      throw toSocialAuthError(err, wrapUnexpected);
    }
    return successResponse(requestId, tokenSet);
  }

  @Post('login')
  @ApiOperation({ summary: 'Kakao social login' })
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: KakaoLoginDto, @Req() req: RequestWithId) {
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
      throw toSocialAuthError(err, wrapUnexpected);
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
