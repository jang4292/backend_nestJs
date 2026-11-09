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
import type { SocialIdentity } from '../../../users/domain/social-identity';
import type { TokenSet } from '../application/ports/apple-auth-code-exchanger.port';
import { VerifyAppleIdTokenUseCase } from '../application/use-cases/verify-apple-id-token.use-case';
import { ExchangeAppleAuthCodeUseCase } from '../application/use-cases/exchange-apple-auth-code.use-case';
import { AppleLoginUseCase } from '../application/use-cases/apple-login.use-case';
import type { AppleLoginOutput } from '../application/use-cases/apple-login.use-case';
import { VerifyIdTokenDto } from './dto/verify-id-token.dto';
import { ExchangeCodeDto } from './dto/exchange-code.dto';
import { AppleLoginDto } from './dto/apple-login.dto';
import { SocialAuthExceptionFilter } from '../../shared/interface/social-auth-exception.filter';
import { SocialProviderRoute } from '../../../common/auth/social-provider-route.decorator';
import { toSocialAuthError } from '../../shared/interface/to-social-auth-error';
import {
  AppleAuthError,
  AppleAuthErrorCode,
} from '../domain/apple-auth.errors';

type AppleLoginResponseData = {
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
  new AppleAuthError(
    AppleAuthErrorCode.AUTH_APPLE_INTERNAL_ERROR,
    'Unexpected error during Apple authentication.',
    { cause },
  );

@Controller('auth/apple')
@ApiTags('auth/apple')
@UseFilters(SocialAuthExceptionFilter)
@SocialProviderRoute('apple')
export class AuthAppleController {
  constructor(
    private readonly verifyIdTokenUseCase: VerifyAppleIdTokenUseCase,
    private readonly exchangeCodeUseCase: ExchangeAppleAuthCodeUseCase,
    private readonly appleLoginUseCase: AppleLoginUseCase,
    private readonly requestIdService: RequestIdService,
  ) {}

  private getRequestId(req: RequestWithId): string {
    return req.requestId ?? this.requestIdService.resolve(req);
  }

  @Post('verify-id-token')
  @ApiOperation({ summary: 'Apple ID token 검증' })
  @HttpCode(HttpStatus.OK)
  async verifyIdToken(
    @Body() dto: VerifyIdTokenDto,
    @Req() req: RequestWithId,
  ) {
    const requestId = this.getRequestId(req);
    let identity: SocialIdentity;
    try {
      identity = await this.verifyIdTokenUseCase.execute({
        idToken: dto.idToken,
        nonce: dto.nonce,
      });
    } catch (err) {
      throw toSocialAuthError(err, wrapUnexpected);
    }
    return successResponse(requestId, identity);
  }

  @Post('exchange-code')
  @ApiOperation({ summary: 'Apple authorization code 교환' })
  @HttpCode(HttpStatus.OK)
  async exchangeCode(@Body() dto: ExchangeCodeDto, @Req() req: RequestWithId) {
    const requestId = this.getRequestId(req);
    let tokenSet: TokenSet;
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
  @ApiOperation({ summary: 'Apple social login' })
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: AppleLoginDto, @Req() req: RequestWithId) {
    const requestId = this.getRequestId(req);
    let result: AppleLoginOutput;
    try {
      result = await this.appleLoginUseCase.execute({
        idToken: dto.idToken,
        code: dto.code,
        nonce: dto.nonce,
        redirectUri: dto.redirectUri,
        state: dto.state,
        expectedState: dto.expectedState,
        user: dto.user,
      });
    } catch (err) {
      throw toSocialAuthError(err, wrapUnexpected);
    }
    const data: AppleLoginResponseData = {
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
