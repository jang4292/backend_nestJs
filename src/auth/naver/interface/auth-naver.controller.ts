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
import { successResponse } from '../../../common/http/api-response';
import { RequestIdInterceptor } from '../../../common/request-id/request-id.interceptor';
import { RequestIdService } from '../../../common/request-id/request-id.service';
import type { RequestWithId } from '../../../common/request-id/request-with-id';
import type { NaverAccessTokenSet } from '../application/ports/naver-oauth.port';
import { ExchangeNaverAuthCodeUseCase } from '../application/use-cases/exchange-naver-auth-code.use-case';
import { NaverLoginUseCase } from '../application/use-cases/naver-login.use-case';
import type { NaverLoginOutput } from '../application/use-cases/naver-login.use-case';
import { ExchangeCodeDto } from './dto/exchange-code.dto';
import { NaverLoginDto } from './dto/naver-login.dto';
import { NaverAuthExceptionFilter } from './naver-auth-exception.filter';
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

@Controller('auth/naver')
@UseInterceptors(RequestIdInterceptor)
@UseFilters(NaverAuthExceptionFilter)
export class AuthNaverController {
  constructor(
    private readonly exchangeCodeUseCase: ExchangeNaverAuthCodeUseCase,
    private readonly naverLoginUseCase: NaverLoginUseCase,
    private readonly requestIdService: RequestIdService,
  ) {}

  private getRequestId(req: RequestWithId): string {
    return req.requestId ?? this.requestIdService.resolve(req);
  }

  private static toNaverAuthError(err: unknown): NaverAuthError {
    if (err instanceof NaverAuthError) return err;
    return new NaverAuthError(
      NaverAuthErrorCode.AUTH_NAVER_INTERNAL_ERROR,
      err instanceof Error ? err.message : String(err),
    );
  }

  @Post('exchange-code')
  @HttpCode(HttpStatus.OK)
  async exchangeCode(
    @Body(ValidationPipe) dto: ExchangeCodeDto,
    @Req() req: RequestWithId,
  ) {
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
      throw AuthNaverController.toNaverAuthError(err);
    }
    return successResponse(requestId, tokenSet);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body(ValidationPipe) dto: NaverLoginDto,
    @Req() req: RequestWithId,
  ) {
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
      throw AuthNaverController.toNaverAuthError(err);
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
