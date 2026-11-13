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
import {
  ApiDefaultErrorResponse,
  ApiProviderUnavailableResponse,
  ApiSuccessEnvelope,
} from '../../../common/http/api-contract.decorators';
import { successResponse } from '../../../common/http/api-response';
import { RequestIdService } from '../../../common/request-id/request-id.service';
import type { RequestWithId } from '../../../common/request-id/request-with-id';
import type { NaverAccessTokenSet } from '../application/ports/naver-oauth.port';
import { ExchangeNaverAuthCodeUseCase } from '../application/use-cases/exchange-naver-auth-code.use-case';
import { NaverLoginUseCase } from '../application/use-cases/naver-login.use-case';
import type { NaverLoginOutput } from '../application/use-cases/naver-login.use-case';
import { ExchangeCodeDto } from './dto/exchange-code.dto';
import { NaverLoginDto } from './dto/naver-login.dto';
import { SocialAuthExceptionFilter } from '../../shared/interface/social-auth-exception.filter';
import { SocialProviderRoute } from '../../../common/auth/social-provider-route.decorator';
import { toSocialAuthError } from '../../shared/interface/to-social-auth-error';
import {
  NaverAuthError,
  NaverAuthErrorCode,
} from '../domain/naver-auth.errors';

type NaverLoginResponseData = {
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
  new NaverAuthError(
    NaverAuthErrorCode.AUTH_NAVER_INTERNAL_ERROR,
    'Unexpected error during Naver authentication.',
    { cause },
  );

@Controller('auth/naver')
@ApiTags('auth/naver')
@ApiDefaultErrorResponse()
@ApiProviderUnavailableResponse()
@UseFilters(SocialAuthExceptionFilter)
@SocialProviderRoute('naver')
export class AuthNaverController {
  constructor(
    private readonly exchangeCodeUseCase: ExchangeNaverAuthCodeUseCase,
    private readonly naverLoginUseCase: NaverLoginUseCase,
    private readonly requestIdService: RequestIdService,
  ) {}

  private getRequestId(req: RequestWithId): string {
    return req.requestId ?? this.requestIdService.resolve(req);
  }

  @Post('exchange-code')
  @ApiOperation({ summary: 'Naver authorization code 교환' })
  @ApiSuccessEnvelope()
  @HttpCode(HttpStatus.OK)
  async exchangeCode(@Body() dto: ExchangeCodeDto, @Req() req: RequestWithId) {
    const requestId = this.getRequestId(req);
    let tokenSet: NaverAccessTokenSet;
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
  @ApiOperation({ summary: 'Naver social login' })
  @ApiSuccessEnvelope()
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: NaverLoginDto, @Req() req: RequestWithId) {
    const requestId = this.getRequestId(req);
    let result: NaverLoginOutput;
    try {
      result = await this.naverLoginUseCase.execute({
        accessToken: dto.accessToken,
        code: dto.code,
        redirectUri: dto.redirectUri,
        state: dto.state,
        expectedState: dto.expectedState,
      });
    } catch (err) {
      throw toSocialAuthError(err, wrapUnexpected);
    }
    const data: NaverLoginResponseData = {
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
