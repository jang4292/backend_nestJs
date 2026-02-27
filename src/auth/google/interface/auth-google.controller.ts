import {
  Controller,
  Post,
  Body,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  ValidationPipe,
  Inject,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { GoogleAuthError, GoogleAuthErrorCode } from '../domain/google-auth.errors';
import { VerifyGoogleIdTokenUseCase } from '../application/use-cases/verify-google-id-token.use-case';
import { ExchangeGoogleAuthCodeUseCase } from '../application/use-cases/exchange-google-auth-code.use-case';
import { GoogleLoginUseCase } from '../application/use-cases/google-login.use-case';
import { REQUEST_ID_PROVIDER_PORT } from '../application/ports/request-id-provider.port';
import type { RequestIdProviderPort } from '../application/ports/request-id-provider.port';
import { VerifyIdTokenDto } from './dto/verify-id-token.dto';
import { ExchangeCodeDto } from './dto/exchange-code.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { successResponse, errorResponse } from './response.helper';

@Controller('auth/google')
export class AuthGoogleController {
  constructor(
    private readonly verifyIdTokenUseCase: VerifyGoogleIdTokenUseCase,
    private readonly exchangeCodeUseCase: ExchangeGoogleAuthCodeUseCase,
    private readonly googleLoginUseCase: GoogleLoginUseCase,
    @Inject(REQUEST_ID_PROVIDER_PORT)
    private readonly requestIdProvider: RequestIdProviderPort,
  ) {}

  private getRequestId(req: Request): string {
    const fromHeader = req.headers['x-request-id'];
    const id = (Array.isArray(fromHeader) ? fromHeader[0] : fromHeader) ?? this.requestIdProvider.generate();
    return id;
  }

  @Post('verify-id-token')
  @HttpCode(HttpStatus.OK)
  async verifyIdToken(
    @Body(ValidationPipe) dto: VerifyIdTokenDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const requestId = this.getRequestId(req);
    res.setHeader('x-request-id', requestId);
    try {
      const identity = await this.verifyIdTokenUseCase.execute({
        idToken: dto.idToken,
        nonce: dto.nonce,
      });
      return res.json(successResponse(requestId, identity));
    } catch (err) {
      return this.handleError(err, requestId, res);
    }
  }

  @Post('exchange-code')
  @HttpCode(HttpStatus.OK)
  async exchangeCode(
    @Body(ValidationPipe) dto: ExchangeCodeDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const requestId = this.getRequestId(req);
    res.setHeader('x-request-id', requestId);
    try {
      const tokenSet = await this.exchangeCodeUseCase.execute({
        code: dto.code,
        redirectUri: dto.redirectUri,
        codeVerifier: dto.codeVerifier,
        state: dto.state,
        expectedState: dto.expectedState,
      });
      return res.json(successResponse(requestId, tokenSet));
    } catch (err) {
      return this.handleError(err, requestId, res);
    }
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body(ValidationPipe) dto: GoogleLoginDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const requestId = this.getRequestId(req);
    res.setHeader('x-request-id', requestId);
    try {
      const result = await this.googleLoginUseCase.execute({
        idToken: dto.idToken,
        code: dto.code,
        nonce: dto.nonce,
        redirectUri: dto.redirectUri,
        codeVerifier: dto.codeVerifier,
        state: dto.state,
        expectedState: dto.expectedState,
      });
      return res.json(
        successResponse(requestId, {
          accessToken: result.session.accessToken,
          expiresIn: result.session.expiresIn,
          user: { id: result.user.id, username: result.user.username, email: result.user.email },
        }),
      );
    } catch (err) {
      return this.handleError(err, requestId, res);
    }
  }

  private handleError(err: unknown, requestId: string, res: Response) {
    if (err instanceof GoogleAuthError) {
      const status = this.errorCodeToHttpStatus(err.errorCode);
      return res
        .status(status)
        .json(errorResponse(requestId, err.errorCode, err.message));
    }
    return res
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .json(
        errorResponse(
          requestId,
          GoogleAuthErrorCode.AUTH_GOOGLE_INTERNAL_ERROR,
          'An unexpected error occurred.',
        ),
      );
  }

  private errorCodeToHttpStatus(code: GoogleAuthErrorCode): number {
    switch (code) {
      case GoogleAuthErrorCode.AUTH_GOOGLE_BAD_REQUEST:
        return HttpStatus.BAD_REQUEST;
      case GoogleAuthErrorCode.AUTH_GOOGLE_INVALID_AUDIENCE:
      case GoogleAuthErrorCode.AUTH_GOOGLE_INVALID_ISSUER:
      case GoogleAuthErrorCode.AUTH_GOOGLE_TOKEN_EXPIRED:
      case GoogleAuthErrorCode.AUTH_GOOGLE_MISSING_SUB:
      case GoogleAuthErrorCode.AUTH_GOOGLE_NONCE_MISMATCH:
      case GoogleAuthErrorCode.AUTH_GOOGLE_STATE_MISMATCH:
      case GoogleAuthErrorCode.AUTH_GOOGLE_EXCHANGE_FAILED:
        return HttpStatus.UNAUTHORIZED;
      default:
        return HttpStatus.INTERNAL_SERVER_ERROR;
    }
  }
}
