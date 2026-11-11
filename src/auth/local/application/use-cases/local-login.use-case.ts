import { Inject, Injectable } from '@nestjs/common';
import {
  RateLimitedError,
  UnauthorizedError,
} from '../../../../common/errors/domain-error';
import { UsersService } from '../../../../users/users.service';
import type { User } from '../../../../users/entities/user.entity';
import { LoginIdentifierType } from '../../../../users/domain/login-identifier-type.enum';
import { SESSION_ISSUER_PORT } from '../../../session/application/ports/session-issuer.port';
import type {
  SessionIssuerPort,
  SessionTokens,
} from '../../../session/application/ports/session-issuer.port';
import { LOGIN_ATTEMPT_LIMITER_PORT } from '../ports/login-attempt-limiter.port';
import type { LoginAttemptLimiterPort } from '../ports/login-attempt-limiter.port';

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
    @Inject(LOGIN_ATTEMPT_LIMITER_PORT)
    private readonly attempts: LoginAttemptLimiterPort,
  ) {}

  async execute(input: LocalLoginInput): Promise<LocalLoginOutput> {
    // 계정 단위 실패 제한(SEC-19). 없는 계정도 같은 키 규칙으로 세므로 차단 여부로 계정 존재를 알 수 없습니다.
    const attemptKey = loginAttemptKey(input.identifierType, input.identifier);
    const retryAfter = this.attempts.retryAfterSeconds(attemptKey);
    if (retryAfter > 0) {
      throw new RateLimitedError(
        'Too many failed login attempts. Try again later.',
        retryAfter,
      );
    }

    // 계정 없음/비밀번호 없음/불일치를 구분하지 않고 같은 비용으로 실패시킵니다.
    const user = await this.usersService.verifyCredentials(
      input.identifierType,
      input.identifier,
      input.password,
    );
    if (!user) {
      this.attempts.recordFailure(attemptKey);
      throw new UnauthorizedError('Invalid credentials');
    }

    this.attempts.reset(attemptKey);
    const session = await this.sessionIssuer.issue(user);
    return { user, session };
  }
}

/** 대소문자·앞뒤 공백만 다른 식별자로 제한을 피하지 못하도록 정규화한 키 */
export function loginAttemptKey(
  identifierType: LoginIdentifierType,
  identifier: string,
): string {
  return `${identifierType}:${identifier.trim().toLowerCase()}`;
}
