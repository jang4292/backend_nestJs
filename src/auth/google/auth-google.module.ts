import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';
import { UsersModule } from '../../users/users.module';
import { SessionModule } from '../session/session.module';

import { GOOGLE_TOKEN_VERIFIER_PORT } from './application/ports/google-token-verifier.port';
import { GOOGLE_AUTH_CODE_EXCHANGER_PORT } from './application/ports/google-auth-code-exchanger.port';

import { VerifyGoogleIdTokenUseCase } from './application/use-cases/verify-google-id-token.use-case';
import { ExchangeGoogleAuthCodeUseCase } from './application/use-cases/exchange-google-auth-code.use-case';
import { GoogleLoginUseCase } from './application/use-cases/google-login.use-case';

import { GoogleOAuthClientAdapter } from './infrastructure/google-oauth-client.adapter';

import { AuthGoogleController } from './interface/auth-google.controller';
import { GoogleAuthExceptionFilter } from './interface/google-auth-exception.filter';

@Module({
  imports: [CommonModule, UsersModule, SessionModule],
  controllers: [AuthGoogleController],
  providers: [
    GoogleOAuthClientAdapter,
    GoogleAuthExceptionFilter,

    {
      provide: GOOGLE_TOKEN_VERIFIER_PORT,
      useExisting: GoogleOAuthClientAdapter,
    },
    {
      provide: GOOGLE_AUTH_CODE_EXCHANGER_PORT,
      useExisting: GoogleOAuthClientAdapter,
    },

    VerifyGoogleIdTokenUseCase,
    ExchangeGoogleAuthCodeUseCase,
    GoogleLoginUseCase,
  ],
})
export class AuthGoogleModule {}
