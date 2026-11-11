import { Injectable } from '@nestjs/common';
import type { User } from './entities/user.entity';
import type { LoginIdentifierType } from './domain/login-identifier-type.enum';
import { CreateUserUseCase } from './application/use-cases/create-user.use-case';
import type { CreateUserCommand } from './application/use-cases/create-user.use-case';
import { UpdateUserUseCase } from './application/use-cases/update-user.use-case';
import type { UpdateProfileCommand } from './application/use-cases/update-user.use-case';
import { FindUserUseCase } from './application/use-cases/find-user.use-case';
import { VerifyCredentialsUseCase } from './application/use-cases/verify-credentials.use-case';

/**
 * Users 모듈의 공개 application API(facade).
 * 다른 모듈(auth/local, auth/session)은 이 서비스만 사용하고 내부 use-case/포트에 직접 의존하지 않습니다.
 */
@Injectable()
export class UsersService {
  constructor(
    private readonly createUserUseCase: CreateUserUseCase,
    private readonly updateUserUseCase: UpdateUserUseCase,
    private readonly findUserUseCase: FindUserUseCase,
    private readonly verifyCredentialsUseCase: VerifyCredentialsUseCase,
  ) {}

  create(command: CreateUserCommand): Promise<User> {
    return this.createUserUseCase.execute(command);
  }

  findOne(username: string): Promise<User | null> {
    return this.findUserUseCase.byUsername(username);
  }

  findByEmail(email: string): Promise<User | null> {
    return this.findUserUseCase.byEmail(email);
  }

  findById(id: number): Promise<User | null> {
    return this.findUserUseCase.byId(id);
  }

  update(id: number, command: UpdateProfileCommand): Promise<User> {
    return this.updateUserUseCase.execute(id, command);
  }

  /** 식별자·비밀번호가 맞으면 사용자, 아니면 null (실패 사유는 구분하지 않음) */
  verifyCredentials(
    identifierType: LoginIdentifierType,
    identifier: string,
    password: string,
  ): Promise<User | null> {
    return this.verifyCredentialsUseCase.execute(
      identifierType,
      identifier,
      password,
    );
  }
}
