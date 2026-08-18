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
import type { SocialIdentity } from '../domain/social-identity';
import type { TokenSet } from '../application/ports/google-auth-code-exchanger.port';
import { VerifyGoogleIdTokenUseCase } from '../application/use-cases/verify-google-id-token.use-case';
import { ExchangeGoogleAuthCodeUseCase } from '../application/use-cases/exchange-google-auth-code.use-case';
import { GoogleLoginUseCase } from '../application/use-cases/google-login.use-case';
import type { GoogleLoginOutput } from '../application/use-cases/google-login.use-case';
import { VerifyIdTokenDto } from './dto/verify-id-token.dto';
import { ExchangeCodeDto } from './dto/exchange-code.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { GoogleAuthExceptionFilter } from './google-auth-exception.filter';

type GoogleLoginResponseData = {
  accessToken: string;
  expiresIn?: number;
  user: {
    id: number;
    username: string;
    email?: string | null;
  };
};

@Controller('auth/google')
@UseInterceptors(RequestIdInterceptor)
@UseFilters(GoogleAuthExceptionFilter)
export class AuthGoogleController {
  constructor(
    private readonly verifyIdTokenUseCase: VerifyGoogleIdTokenUseCase,
    private readonly exchangeCodeUseCase: ExchangeGoogleAuthCodeUseCase,
    private readonly googleLoginUseCase: GoogleLoginUseCase,
    private readonly requestIdService: RequestIdService,
  ) {}

  private getRequestId(req: RequestWithId): string {
    return req.requestId ?? this.requestIdService.resolve(req);
  }

  @Post('verify-id-token')
  @HttpCode(HttpStatus.OK)
  async verifyIdToken(
    @Body(ValidationPipe) dto: VerifyIdTokenDto,
    @Req() req: RequestWithId,
  ) {
    const requestId = this.getRequestId(req);
    const identity: SocialIdentity = await this.verifyIdTokenUseCase.execute({
      idToken: dto.idToken,
      nonce: dto.nonce,
    });
    return successResponse(requestId, identity);
  }

  @Post('exchange-code')
  @HttpCode(HttpStatus.OK)
  async exchangeCode(
    @Body(ValidationPipe) dto: ExchangeCodeDto,
    @Req() req: RequestWithId,
  ) {
    const requestId = this.getRequestId(req);
    const tokenSet: TokenSet = await this.exchangeCodeUseCase.execute({
      code: dto.code,
      redirectUri: dto.redirectUri,
      codeVerifier: dto.codeVerifier,
      state: dto.state,
      expectedState: dto.expectedState,
    });
    return successResponse(requestId, tokenSet);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body(ValidationPipe) dto: GoogleLoginDto,
    @Req() req: RequestWithId,
  ) {
    const requestId = this.getRequestId(req);
    const result: GoogleLoginOutput = await this.googleLoginUseCase.execute({
      idToken: dto.idToken,
      code: dto.code,
      nonce: dto.nonce,
      redirectUri: dto.redirectUri,
      codeVerifier: dto.codeVerifier,
      state: dto.state,
      expectedState: dto.expectedState,
    });
    const data: GoogleLoginResponseData = {
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
