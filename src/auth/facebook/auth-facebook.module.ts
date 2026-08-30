import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';
import { UsersModule } from '../../users/users.module';
import { SessionModule } from '../session/session.module';

import { FACEBOOK_OAUTH_PORT } from './application/ports/facebook-oauth.port';
import { ExchangeFacebookAuthCodeUseCase } from './application/use-cases/exchange-facebook-auth-code.use-case';
import { FacebookLoginUseCase } from './application/use-cases/facebook-login.use-case';

import { FacebookGraphApiAdapter } from './infrastructure/facebook-graph-api.adapter';

import { AuthFacebookController } from './interface/auth-facebook.controller';
import { FacebookAuthExceptionFilter } from './interface/facebook-auth-exception.filter';

@Module({
  imports: [CommonModule, UsersModule, SessionModule],
  controllers: [AuthFacebookController],
  providers: [
    FacebookGraphApiAdapter,
    FacebookAuthExceptionFilter,

    { provide: FACEBOOK_OAUTH_PORT, useExisting: FacebookGraphApiAdapter },

    ExchangeFacebookAuthCodeUseCase,
    FacebookLoginUseCase,
  ],
})
export class AuthFacebookModule {}
