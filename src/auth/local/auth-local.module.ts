import { Module } from '@nestjs/common';
import { UsersModule } from '../../users/users.module';
import { SessionModule } from '../session/session.module';
import { LocalLoginUseCase } from './application/use-cases/local-login.use-case';
import { AuthLocalController } from './interface/auth-local.controller';

@Module({
  imports: [UsersModule, SessionModule],
  controllers: [AuthLocalController],
  providers: [LocalLoginUseCase],
})
export class AuthLocalModule {}
