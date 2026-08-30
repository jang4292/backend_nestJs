import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';
import { UsersModule } from '../../users/users.module';
import { SessionModule } from '../session/session.module';

import { KAKAO_OAUTH_PORT } from './application/ports/kakao-oauth.port';
import { ExchangeKakaoAuthCodeUseCase } from './application/use-cases/exchange-kakao-auth-code.use-case';
import { KakaoLoginUseCase } from './application/use-cases/kakao-login.use-case';

import { KakaoOAuthClientAdapter } from './infrastructure/kakao-oauth-client.adapter';

import { AuthKakaoController } from './interface/auth-kakao.controller';
import { KakaoAuthExceptionFilter } from './interface/kakao-auth-exception.filter';

@Module({
  imports: [CommonModule, UsersModule, SessionModule],
  controllers: [AuthKakaoController],
  providers: [
    KakaoOAuthClientAdapter,
    KakaoAuthExceptionFilter,

    { provide: KAKAO_OAUTH_PORT, useExisting: KakaoOAuthClientAdapter },

    ExchangeKakaoAuthCodeUseCase,
    KakaoLoginUseCase,
  ],
})
export class AuthKakaoModule {}
