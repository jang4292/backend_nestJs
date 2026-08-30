import { Inject, Injectable } from '@nestjs/common';
import {
  FacebookAuthErrorCode,
  FacebookAuthError,
} from '../../domain/facebook-auth.errors';
import { FACEBOOK_OAUTH_PORT } from '../ports/facebook-oauth.port';
import type {
  FacebookAccessTokenSet,
  FacebookOAuthPort,
} from '../ports/facebook-oauth.port';

export interface ExchangeFacebookAuthCodeInput {
  code: string;
  redirectUri: string;
  state?: string;
  expectedState?: string;
}

@Injectable()
export class ExchangeFacebookAuthCodeUseCase {
  constructor(
    @Inject(FACEBOOK_OAUTH_PORT)
    private readonly oauth: FacebookOAuthPort,
  ) {}

  async execute(
    input: ExchangeFacebookAuthCodeInput,
  ): Promise<FacebookAccessTokenSet> {
    if (
      input.state !== undefined &&
      input.expectedState !== undefined &&
      input.state !== input.expectedState
    ) {
      throw new FacebookAuthError(
        FacebookAuthErrorCode.AUTH_FACEBOOK_STATE_MISMATCH,
        'State parameter mismatch – possible CSRF attack.',
      );
    }
    return this.oauth.exchange(input);
  }
}
