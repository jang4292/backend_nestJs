import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';
import { UsersModule } from '../../users/users.module';
import { SessionModule } from '../session/session.module';

import { APPLE_TOKEN_VERIFIER_PORT } from './application/ports/apple-token-verifier.port';
import { APPLE_AUTH_CODE_EXCHANGER_PORT } from './application/ports/apple-auth-code-exchanger.port';

import { VerifyAppleIdTokenUseCase } from './application/use-cases/verify-apple-id-token.use-case';
import { ExchangeAppleAuthCodeUseCase } from './application/use-cases/exchange-apple-auth-code.use-case';
import { AppleLoginUseCase } from './application/use-cases/apple-login.use-case';

import { AppleJwksVerifierAdapter } from './infrastructure/apple-jwks-verifier.adapter';
import { AppleOAuthClientAdapter } from './infrastructure/apple-oauth-client.adapter';

import { AuthAppleController } from './interface/auth-apple.controller';
import { AppleAuthExceptionFilter } from './interface/apple-auth-exception.filter';

@Module({
  imports: [CommonModule, UsersModule, SessionModule],
  controllers: [AuthAppleController],
  providers: [
    AppleJwksVerifierAdapter,
    AppleOAuthClientAdapter,
    AppleAuthExceptionFilter,

    {
      provide: APPLE_TOKEN_VERIFIER_PORT,
      useExisting: AppleJwksVerifierAdapter,
    },
    {
      provide: APPLE_AUTH_CODE_EXCHANGER_PORT,
      useExisting: AppleOAuthClientAdapter,
    },

    VerifyAppleIdTokenUseCase,
    ExchangeAppleAuthCodeUseCase,
    AppleLoginUseCase,
  ],
})
export class AuthAppleModule {}
