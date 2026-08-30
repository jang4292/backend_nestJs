import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersController } from './interface/users.controller';
import { User } from './entities/user.entity';
import { SocialAccount } from './entities/social-account.entity';
import { SocialAccountLinkerTypeOrmAdapter } from './infrastructure/social-account-linker-typeorm.adapter';
import { SOCIAL_ACCOUNT_LINKER_PORT } from './application/ports/social-account-linker.port';
import { CreateUserUseCase } from './application/use-cases/create-user.use-case';
import { UpdateUserUseCase } from './application/use-cases/update-user.use-case';
import { FindUserUseCase } from './application/use-cases/find-user.use-case';
import { ValidatePasswordUseCase } from './application/use-cases/validate-password.use-case';

@Module({
  imports: [TypeOrmModule.forFeature([User, SocialAccount])],
  controllers: [UsersController],
  providers: [
    UsersService,
    CreateUserUseCase,
    UpdateUserUseCase,
    FindUserUseCase,
    ValidatePasswordUseCase,
    SocialAccountLinkerTypeOrmAdapter,
    {
      provide: SOCIAL_ACCOUNT_LINKER_PORT,
      useExisting: SocialAccountLinkerTypeOrmAdapter,
    },
  ],
  exports: [UsersService, SOCIAL_ACCOUNT_LINKER_PORT],
})
export class UsersModule {}
