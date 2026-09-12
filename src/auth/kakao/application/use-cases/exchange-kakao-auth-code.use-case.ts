import { Inject, Injectable } from '@nestjs/common';
import {
  KakaoAuthErrorCode,
  KakaoAuthError,
} from '../../domain/kakao-auth.errors';
import { KAKAO_OAUTH_PORT } from '../ports/kakao-oauth.port';
import type {
  KakaoAccessTokenSet,
  KakaoOAuthPort,
} from '../ports/kakao-oauth.port';

export interface ExchangeKakaoAuthCodeInput {
  code: string;
  redirectUri: string;
  state?: string;
  expectedState?: string;
}

@Injectable()
export class ExchangeKakaoAuthCodeUseCase {
  constructor(
    @Inject(KAKAO_OAUTH_PORT)
    private readonly oauth: KakaoOAuthPort,
  ) {}

  async execute(
    input: ExchangeKakaoAuthCodeInput,
  ): Promise<KakaoAccessTokenSet> {
    if (
      (input.state === undefined) !== (input.expectedState === undefined) ||
      input.state !== input.expectedState
    ) {
      throw new KakaoAuthError(
        KakaoAuthErrorCode.AUTH_KAKAO_STATE_MISMATCH,
        'State parameter mismatch – possible CSRF attack.',
      );
    }
    return this.oauth.exchange(input);
  }
}
