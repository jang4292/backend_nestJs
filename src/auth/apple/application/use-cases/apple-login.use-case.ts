import { Inject, Injectable } from '@nestjs/common';
import {
  AppleAuthErrorCode,
  AppleAuthError,
} from '../../domain/apple-auth.errors';
import { APPLE_TOKEN_VERIFIER_PORT } from '../ports/apple-token-verifier.port';
import type { AppleTokenVerifierPort } from '../ports/apple-token-verifier.port';
import { APPLE_AUTH_CODE_EXCHANGER_PORT } from '../ports/apple-auth-code-exchanger.port';
import type { AppleAuthCodeExchangerPort } from '../ports/apple-auth-code-exchanger.port';
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

export interface AppleLoginInput {
  /** Provide exactly one of idToken or code */
  idToken?: string;
  code?: string;
  nonce?: string;
  redirectUri?: string;
  state?: string;
  expectedState?: string;
  /** Apple only returns this on the user's first authorization */
  user?: { name?: string; email?: string };
}

export interface AppleLoginOutput {
  user: SocialUserRecord;
  session: SessionTokens;
}

@Injectable()
export class AppleLoginUseCase {
  constructor(
    @Inject(APPLE_TOKEN_VERIFIER_PORT)
    private readonly verifier: AppleTokenVerifierPort,
    @Inject(APPLE_AUTH_CODE_EXCHANGER_PORT)
    private readonly exchanger: AppleAuthCodeExchangerPort,
    @Inject(SOCIAL_ACCOUNT_LINKER_PORT)
    private readonly userRepo: SocialAccountLinkerPort,
    @Inject(SESSION_ISSUER_PORT)
    private readonly sessionIssuer: SessionIssuerPort,
  ) {}

  async execute(input: AppleLoginInput): Promise<AppleLoginOutput> {
    const hasIdToken = Boolean(input.idToken);
    const hasCode = Boolean(input.code);

    if (hasIdToken === hasCode) {
      throw new AppleAuthError(
        AppleAuthErrorCode.AUTH_APPLE_BAD_REQUEST,
        'Provide exactly one of idToken or code.',
      );
    }

    let idToken: string;
    if (hasIdToken) {
      idToken = input.idToken!;
    } else {
      if (!input.redirectUri) {
        throw new AppleAuthError(
          AppleAuthErrorCode.AUTH_APPLE_BAD_REQUEST,
          'redirectUri is required when using auth code flow.',
        );
      }
      if (
        (input.state === undefined) !== (input.expectedState === undefined) ||
        input.state !== input.expectedState
      ) {
        throw new AppleAuthError(
          AppleAuthErrorCode.AUTH_APPLE_STATE_MISMATCH,
          'State parameter mismatch – possible CSRF attack.',
        );
      }
      const tokenSet = await this.exchanger.exchange({
        code: input.code!,
        redirectUri: input.redirectUri,
        state: input.state,
        expectedState: input.expectedState,
      });
      idToken = tokenSet.idToken;
    }

    const identity = await this.verifier.verifyIdToken(idToken, input.nonce);
    // Apple은 최초 인증 시에만 클라이언트로 name/email을 보냅니다. 이 값은 서명되지 않았으므로
    // 서명된 ID Token의 claim을 우선하고, token에 email이 없을 때만 클라이언트 값을 미검증으로 사용합니다.
    const clientEmail = input.user?.email;
    const enrichedIdentity = {
      ...identity,
      name: identity.name ?? input.user?.name,
      email: identity.email ?? clientEmail,
      emailVerified: identity.email
        ? identity.emailVerified
        : clientEmail
          ? false
          : identity.emailVerified,
    };
    const user = await this.userRepo.upsert(enrichedIdentity);
    const session = await this.sessionIssuer.issue(user);

    return { user, session };
  }
}
