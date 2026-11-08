import { Inject, Injectable } from '@nestjs/common';
import { UnauthorizedError } from '../../../../common/errors/domain-error';
import { UsersService } from '../../../../users/users.service';
import type { User } from '../../../../users/entities/user.entity';
import { LoginIdentifierType } from '../../../../users/domain/login-identifier-type.enum';
import { SESSION_ISSUER_PORT } from '../../../session/application/ports/session-issuer.port';
import type {
  SessionIssuerPort,
  SessionTokens,
} from '../../../session/application/ports/session-issuer.port';

export interface LocalLoginInput {
  identifierType: LoginIdentifierType;
  identifier: string;
  password: string;
}

export interface LocalLoginOutput {
  user: User;
  session: SessionTokens;
}

@Injectable()
export class LocalLoginUseCase {
  constructor(
    private readonly usersService: UsersService,
    @Inject(SESSION_ISSUER_PORT)
    private readonly sessionIssuer: SessionIssuerPort,
  ) {}

  async execute(input: LocalLoginInput): Promise<LocalLoginOutput> {
    // 계정 없음/비밀번호 없음/불일치를 구분하지 않고 같은 비용으로 실패시킵니다.
    const user = await this.usersService.verifyCredentials(
      input.identifierType,
      input.identifier,
      input.password,
    );
    if (!user) {
      throw new UnauthorizedError('Invalid credentials');
    }

    const session = await this.sessionIssuer.issue(user);
    return { user, session };
  }
}
