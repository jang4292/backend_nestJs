import { Module } from '@nestjs/common';
import { UsersModule } from '../../users/users.module';
import { SessionModule } from '../session/session.module';
import { LocalLoginUseCase } from './application/use-cases/local-login.use-case';
import { AuthLocalController } from './interface/auth-local.controller';
import { LOGIN_ATTEMPT_LIMITER_PORT } from './application/ports/login-attempt-limiter.port';
import { InMemoryLoginAttemptLimiterAdapter } from './infrastructure/in-memory-login-attempt-limiter.adapter';

@Module({
  imports: [UsersModule, SessionModule],
  controllers: [AuthLocalController],
  providers: [
    LocalLoginUseCase,
    {
      provide: LOGIN_ATTEMPT_LIMITER_PORT,
      useFactory: () => new InMemoryLoginAttemptLimiterAdapter(),
    },
  ],
})
export class AuthLocalModule {}
