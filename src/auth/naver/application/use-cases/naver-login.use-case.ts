import { Inject, Injectable } from '@nestjs/common';
import {
  NaverAuthErrorCode,
  NaverAuthError,
} from '../../domain/naver-auth.errors';
import { NAVER_OAUTH_PORT } from '../ports/naver-oauth.port';
import type { NaverOAuthPort } from '../ports/naver-oauth.port';
import { SOCIAL_ACCOUNT_LINKER_PORT } from '../../../../users/application/ports/social-account-linker.port';
import type {
  SocialUserRecord,
  SocialAccountLinkerPort,
} from '../../../../users/application/ports/social-account-linker.port';
import { SESSION_ISSUER_PORT } from '../../../session/application/ports/session-issuer.port';
import type {
  SessionIssuerPort,
  SessionTokens,
} from '../../../session/application/ports/session-issuer.port';

export interface NaverLoginInput {
  /** Provide exactly one of accessToken or code */
  accessToken?: string;
  code?: string;
  redirectUri?: string;
  state?: string;
  expectedState?: string;
}

export interface NaverLoginOutput {
  user: SocialUserRecord;
  session: SessionTokens;
}

@Injectable()
export class NaverLoginUseCase {
  constructor(
    @Inject(NAVER_OAUTH_PORT)
    private readonly oauth: NaverOAuthPort,
    @Inject(SOCIAL_ACCOUNT_LINKER_PORT)
    private readonly userRepo: SocialAccountLinkerPort,
    @Inject(SESSION_ISSUER_PORT)
    private readonly sessionIssuer: SessionIssuerPort,
  ) {}

  async execute(input: NaverLoginInput): Promise<NaverLoginOutput> {
    const hasAccessToken = Boolean(input.accessToken);
    const hasCode = Boolean(input.code);

    if (hasAccessToken === hasCode) {
      throw new NaverAuthError(
        NaverAuthErrorCode.AUTH_NAVER_BAD_REQUEST,
        'Provide exactly one of accessToken or code.',
      );
    }

    let accessToken: string;
    if (hasAccessToken) {
      accessToken = input.accessToken!;
    } else {
      if (!input.redirectUri) {
        throw new NaverAuthError(
          NaverAuthErrorCode.AUTH_NAVER_BAD_REQUEST,
          'redirectUri is required when using auth code flow.',
        );
      }
      if (
        input.state !== undefined &&
        input.expectedState !== undefined &&
        input.state !== input.expectedState
      ) {
        throw new NaverAuthError(
          NaverAuthErrorCode.AUTH_NAVER_STATE_MISMATCH,
          'State parameter mismatch – possible CSRF attack.',
        );
      }
      const tokenSet = await this.oauth.exchange({
        code: input.code!,
        redirectUri: input.redirectUri,
        state: input.state,
        expectedState: input.expectedState,
      });
      accessToken = tokenSet.accessToken;
    }

    const identity = await this.oauth.fetchProfile(accessToken);
    const user = await this.userRepo.upsert(identity);
    const session = await this.sessionIssuer.issue(user);

    return { user, session };
  }
}
