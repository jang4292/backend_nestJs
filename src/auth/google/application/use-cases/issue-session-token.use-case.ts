import { Inject, Injectable } from '@nestjs/common';
import {
  SESSION_ISSUER_PORT,
} from '../ports/session-issuer.port';
import type {
  SessionIssuerPort,
  SessionTokens,
} from '../ports/session-issuer.port';
import type { SocialUserRecord } from '../ports/social-user-repository.port';

@Injectable()
export class IssueSessionTokenUseCase {
  constructor(
    @Inject(SESSION_ISSUER_PORT)
    private readonly issuer: SessionIssuerPort,
  ) {}

  async execute(user: SocialUserRecord): Promise<SessionTokens> {
    return this.issuer.issue(user);
  }
}
