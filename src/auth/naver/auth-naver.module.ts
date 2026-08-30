import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';
import { UsersModule } from '../../users/users.module';
import { SessionModule } from '../session/session.module';

import { NAVER_OAUTH_PORT } from './application/ports/naver-oauth.port';
import { ExchangeNaverAuthCodeUseCase } from './application/use-cases/exchange-naver-auth-code.use-case';
import { NaverLoginUseCase } from './application/use-cases/naver-login.use-case';

import { NaverOAuthClientAdapter } from './infrastructure/naver-oauth-client.adapter';

import { AuthNaverController } from './interface/auth-naver.controller';
import { NaverAuthExceptionFilter } from './interface/naver-auth-exception.filter';

@Module({
  imports: [CommonModule, UsersModule, SessionModule],
  controllers: [AuthNaverController],
  providers: [
    NaverOAuthClientAdapter,
    NaverAuthExceptionFilter,

    { provide: NAVER_OAUTH_PORT, useExisting: NaverOAuthClientAdapter },

    ExchangeNaverAuthCodeUseCase,
    NaverLoginUseCase,
  ],
})
export class AuthNaverModule {}
