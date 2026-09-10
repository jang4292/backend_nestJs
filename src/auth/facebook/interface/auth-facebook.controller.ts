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
import type { FacebookAccessTokenSet } from '../application/ports/facebook-oauth.port';
import { ExchangeFacebookAuthCodeUseCase } from '../application/use-cases/exchange-facebook-auth-code.use-case';
import { FacebookLoginUseCase } from '../application/use-cases/facebook-login.use-case';
import type { FacebookLoginOutput } from '../application/use-cases/facebook-login.use-case';
import { ExchangeCodeDto } from './dto/exchange-code.dto';
import { FacebookLoginDto } from './dto/facebook-login.dto';
import { FacebookAuthExceptionFilter } from './facebook-auth-exception.filter';
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

@Controller('auth/facebook')
@ApiTags('auth/facebook')
@UseInterceptors(RequestIdInterceptor)
@UseFilters(FacebookAuthExceptionFilter)
export class AuthFacebookController {
  constructor(
    private readonly exchangeCodeUseCase: ExchangeFacebookAuthCodeUseCase,
    private readonly facebookLoginUseCase: FacebookLoginUseCase,
    private readonly requestIdService: RequestIdService,
  ) {}

  private getRequestId(req: RequestWithId): string {
    return req.requestId ?? this.requestIdService.resolve(req);
  }

  private static toFacebookAuthError(err: unknown): FacebookAuthError {
    if (err instanceof FacebookAuthError) return err;
    return new FacebookAuthError(
      FacebookAuthErrorCode.AUTH_FACEBOOK_INTERNAL_ERROR,
      err instanceof Error ? err.message : String(err),
    );
  }

  @Post('exchange-code')
  @ApiOperation({ summary: 'Facebook authorization code 교환' })
  @HttpCode(HttpStatus.OK)
  async exchangeCode(
    @Body(ValidationPipe) dto: ExchangeCodeDto,
    @Req() req: RequestWithId,
  ) {
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
      throw AuthFacebookController.toFacebookAuthError(err);
    }
    return successResponse(requestId, tokenSet);
  }

  @Post('login')
  @ApiOperation({ summary: 'Facebook social login' })
  @HttpCode(HttpStatus.OK)
  async login(
    @Body(ValidationPipe) dto: FacebookLoginDto,
    @Req() req: RequestWithId,
  ) {
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
      throw AuthFacebookController.toFacebookAuthError(err);
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
