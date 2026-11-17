import { Inject, Injectable } from '@nestjs/common';
import type { LoginIdentifierType } from '../../domain/login-identifier-type.enum';
import type { User } from '../../entities/user.entity';
import { PASSWORD_HASHER_PORT } from '../ports/password-hasher.port';
import type { PasswordHasherPort } from '../ports/password-hasher.port';
import { USER_REPOSITORY_PORT } from '../ports/user-repository.port';
import type { UserRepositoryPort } from '../ports/user-repository.port';

/**
 * 로그인 식별자와 비밀번호를 검증합니다. 실패 사유(계정 없음/비밀번호 없음/불일치)를
 * 구분하지 않고 null을 반환합니다. 모든 경로에서 bcrypt 비교를 해 타이밍 차이를 줄이지만
 * 전체 요청 시간이 같다고 보장하지는 않습니다.
 *
 * Return the same failure for missing accounts and bad passwords. Each path performs
 * a bcrypt comparison to reduce timing differences, not to guarantee constant time.
 */
@Injectable()
export class VerifyCredentialsUseCase {
  constructor(
    @Inject(USER_REPOSITORY_PORT)
    private readonly users: UserRepositoryPort,
    @Inject(PASSWORD_HASHER_PORT)
    private readonly passwordHasher: PasswordHasherPort,
  ) {}

  async execute(
    identifierType: LoginIdentifierType,
    identifier: string,
    password: string,
  ): Promise<User | null> {
    const credentials = await this.users.findCredentialsByIdentifier(
      identifierType,
      identifier,
    );
    const isValid = await this.passwordHasher.compare(
      password,
      credentials?.passwordHash ?? null,
    );
    return isValid && credentials ? credentials.user : null;
  }
}
