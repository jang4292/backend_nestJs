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
import type { FacebookAccessTokenSet } from '../application/ports/facebook-oauth.port';
import { ExchangeFacebookAuthCodeUseCase } from '../application/use-cases/exchange-facebook-auth-code.use-case';
import { FacebookLoginUseCase } from '../application/use-cases/facebook-login.use-case';
import type { FacebookLoginOutput } from '../application/use-cases/facebook-login.use-case';
import { ExchangeCodeDto } from './dto/exchange-code.dto';
import { FacebookLoginDto } from './dto/facebook-login.dto';
import { SocialAuthExceptionFilter } from '../../shared/interface/social-auth-exception.filter';
import { SocialProviderRoute } from '../../../common/auth/social-provider-route.decorator';
import { toSocialAuthError } from '../../shared/interface/to-social-auth-error';
import {
  FacebookAuthError,
  FacebookAuthErrorCode,
} from '../domain/facebook-auth.errors';

type FacebookLoginResponseData = {
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
  new FacebookAuthError(
    FacebookAuthErrorCode.AUTH_FACEBOOK_INTERNAL_ERROR,
    'Unexpected error during Facebook authentication.',
    { cause },
  );

@Controller('auth/facebook')
@ApiTags('auth/facebook')
@ApiDefaultErrorResponse()
@ApiProviderUnavailableResponse()
@UseFilters(SocialAuthExceptionFilter)
@SocialProviderRoute('facebook')
export class AuthFacebookController {
  constructor(
    private readonly exchangeCodeUseCase: ExchangeFacebookAuthCodeUseCase,
    private readonly facebookLoginUseCase: FacebookLoginUseCase,
    private readonly requestIdService: RequestIdService,
  ) {}

  private getRequestId(req: RequestWithId): string {
    return req.requestId ?? this.requestIdService.resolve(req);
  }

  @Post('exchange-code')
  @ApiOperation({ summary: 'Facebook authorization code 교환' })
  @ApiSuccessEnvelope()
  @HttpCode(HttpStatus.OK)
  async exchangeCode(@Body() dto: ExchangeCodeDto, @Req() req: RequestWithId) {
    const requestId = this.getRequestId(req);
    let tokenSet: FacebookAccessTokenSet;
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
  @ApiOperation({ summary: 'Facebook social login' })
  @ApiSuccessEnvelope()
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: FacebookLoginDto, @Req() req: RequestWithId) {
    const requestId = this.getRequestId(req);
    let result: FacebookLoginOutput;
    try {
      result = await this.facebookLoginUseCase.execute({
        accessToken: dto.accessToken,
        code: dto.code,
        redirectUri: dto.redirectUri,
        state: dto.state,
        expectedState: dto.expectedState,
      });
    } catch (err) {
      throw toSocialAuthError(err, wrapUnexpected);
    }
    const data: FacebookLoginResponseData = {
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
