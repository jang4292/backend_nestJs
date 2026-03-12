import { Inject, Injectable } from '@nestjs/common';
import {
  GoogleAuthErrorCode,
  GoogleAuthError,
} from '../../domain/google-auth.errors';
import {
  GOOGLE_TOKEN_VERIFIER_PORT,
} from '../ports/google-token-verifier.port';
import type { GoogleTokenVerifierPort } from '../ports/google-token-verifier.port';
import {
  GOOGLE_AUTH_CODE_EXCHANGER_PORT,
} from '../ports/google-auth-code-exchanger.port';
import type { GoogleAuthCodeExchangerPort } from '../ports/google-auth-code-exchanger.port';
import {
  SOCIAL_USER_REPOSITORY_PORT,
} from '../ports/social-user-repository.port';
import type {
  SocialUserRecord,
  SocialUserRepositoryPort,
} from '../ports/social-user-repository.port';
import {
  SESSION_ISSUER_PORT,
} from '../ports/session-issuer.port';
import type {
  SessionIssuerPort,
  SessionTokens,
} from '../ports/session-issuer.port';

export interface GoogleLoginInput {
  /** Provide exactly one of idToken or code */
  idToken?: string;
  code?: string;
  nonce?: string;
  redirectUri?: string;
  codeVerifier?: string;
  state?: string;
  expectedState?: string;
}

export interface GoogleLoginOutput {
  user: SocialUserRecord;
  session: SessionTokens;
}

@Injectable()
export class GoogleLoginUseCase {
  constructor(
    @Inject(GOOGLE_TOKEN_VERIFIER_PORT)
    private readonly verifier: GoogleTokenVerifierPort,
    @Inject(GOOGLE_AUTH_CODE_EXCHANGER_PORT)
    private readonly exchanger: GoogleAuthCodeExchangerPort,
    @Inject(SOCIAL_USER_REPOSITORY_PORT)
    private readonly userRepo: SocialUserRepositoryPort,
    @Inject(SESSION_ISSUER_PORT)
    private readonly sessionIssuer: SessionIssuerPort,
  ) {}

  async execute(input: GoogleLoginInput): Promise<GoogleLoginOutput> {
    const hasIdToken = Boolean(input.idToken);
    const hasCode = Boolean(input.code);

    if (hasIdToken === hasCode) {
      throw new GoogleAuthError(
        GoogleAuthErrorCode.AUTH_GOOGLE_BAD_REQUEST,
        'Provide exactly one of idToken or code.',
      );
    }

    let idToken: string;
    if (hasIdToken) {
      idToken = input.idToken!;
    } else {
      if (!input.redirectUri) {
        throw new GoogleAuthError(
          GoogleAuthErrorCode.AUTH_GOOGLE_BAD_REQUEST,
          'redirectUri is required when using auth code flow.',
        );
      }
      if (
        input.state !== undefined &&
        input.expectedState !== undefined &&
        input.state !== input.expectedState
      ) {
        throw new GoogleAuthError(
          GoogleAuthErrorCode.AUTH_GOOGLE_STATE_MISMATCH,
          'State parameter mismatch – possible CSRF attack.',
        );
      }
      const tokenSet = await this.exchanger.exchange({
        code: input.code!,
        redirectUri: input.redirectUri,
        codeVerifier: input.codeVerifier,
        state: input.state,
        expectedState: input.expectedState,
      });
      idToken = tokenSet.idToken;
    }

    const identity = await this.verifier.verifyIdToken(idToken, input.nonce);
    const user = await this.userRepo.upsert(identity);
    const session = await this.sessionIssuer.issue(user);

    return { user, session };
  }
}
