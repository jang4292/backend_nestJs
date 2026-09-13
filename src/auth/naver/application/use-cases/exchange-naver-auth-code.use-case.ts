import { Inject, Injectable } from '@nestjs/common';
import {
  NaverAuthErrorCode,
  NaverAuthError,
} from '../../domain/naver-auth.errors';
import { NAVER_OAUTH_PORT } from '../ports/naver-oauth.port';
import type {
  NaverAccessTokenSet,
  NaverOAuthPort,
} from '../ports/naver-oauth.port';

export interface ExchangeNaverAuthCodeInput {
  code: string;
  redirectUri: string;
  state?: string;
  expectedState?: string;
}

@Injectable()
export class ExchangeNaverAuthCodeUseCase {
  constructor(
    @Inject(NAVER_OAUTH_PORT)
    private readonly oauth: NaverOAuthPort,
  ) {}

  async execute(
    input: ExchangeNaverAuthCodeInput,
  ): Promise<NaverAccessTokenSet> {
    if (
      (input.state === undefined) !== (input.expectedState === undefined) ||
      input.state !== input.expectedState
    ) {
      throw new NaverAuthError(
        NaverAuthErrorCode.AUTH_NAVER_STATE_MISMATCH,
        'State parameter mismatch – possible CSRF attack.',
      );
    }
    return this.oauth.exchange(input);
  }
}
