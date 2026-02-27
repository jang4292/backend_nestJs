import { Module } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UsersModule } from '../../users/users.module';

import { GOOGLE_TOKEN_VERIFIER_PORT } from './application/ports/google-token-verifier.port';
import { GOOGLE_AUTH_CODE_EXCHANGER_PORT } from './application/ports/google-auth-code-exchanger.port';
import { SOCIAL_USER_REPOSITORY_PORT } from './application/ports/social-user-repository.port';
import { SESSION_ISSUER_PORT } from './application/ports/session-issuer.port';
import { REQUEST_ID_PROVIDER_PORT } from './application/ports/request-id-provider.port';

import { VerifyGoogleIdTokenUseCase } from './application/use-cases/verify-google-id-token.use-case';
import { ExchangeGoogleAuthCodeUseCase } from './application/use-cases/exchange-google-auth-code.use-case';
import { UpsertSocialUserUseCase } from './application/use-cases/upsert-social-user.use-case';
import { IssueSessionTokenUseCase } from './application/use-cases/issue-session-token.use-case';
import { GoogleLoginUseCase } from './application/use-cases/google-login.use-case';

import { GoogleOAuthClientAdapter } from './infrastructure/google-oauth-client.adapter';
import { SocialUserTypeOrmAdapter } from './infrastructure/social-user-typeorm.adapter';
import { SessionIssuerJwtAdapter } from './infrastructure/session-issuer-jwt.adapter';
import { RequestIdAdapter } from './infrastructure/request-id.adapter';

import { AuthGoogleController } from './interface/auth-google.controller';

@Module({
  imports: [
    UsersModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const secret = configService.get<string>('JWT_SECRET');
        if (!secret) {
          throw new Error('JWT_SECRET is not configured.');
        }
        return {
          secret,
          signOptions: { expiresIn: configService.get('JWT_EXPIRES_IN') || '1h' },
        };
      },
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthGoogleController],
  providers: [
    GoogleOAuthClientAdapter,
    SocialUserTypeOrmAdapter,
    SessionIssuerJwtAdapter,
    RequestIdAdapter,

    { provide: GOOGLE_TOKEN_VERIFIER_PORT, useExisting: GoogleOAuthClientAdapter },
    { provide: GOOGLE_AUTH_CODE_EXCHANGER_PORT, useExisting: GoogleOAuthClientAdapter },
    { provide: SOCIAL_USER_REPOSITORY_PORT, useExisting: SocialUserTypeOrmAdapter },
    { provide: SESSION_ISSUER_PORT, useExisting: SessionIssuerJwtAdapter },
    { provide: REQUEST_ID_PROVIDER_PORT, useExisting: RequestIdAdapter },

    VerifyGoogleIdTokenUseCase,
    ExchangeGoogleAuthCodeUseCase,
    UpsertSocialUserUseCase,
    IssueSessionTokenUseCase,
    GoogleLoginUseCase,
  ],
})
export class AuthGoogleModule {}
