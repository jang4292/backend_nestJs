import { Inject, Injectable } from '@nestjs/common';
import {
  GoogleAuthErrorCode,
  GoogleAuthError,
} from '../../domain/google-auth.errors';
import {
  GOOGLE_AUTH_CODE_EXCHANGER_PORT,
} from '../ports/google-auth-code-exchanger.port';
import type {
  GoogleAuthCodeExchangerPort,
  TokenSet,
} from '../ports/google-auth-code-exchanger.port';

export interface ExchangeGoogleAuthCodeInput {
  code: string;
  redirectUri: string;
  codeVerifier?: string;
  state?: string;
  expectedState?: string;
}

@Injectable()
export class ExchangeGoogleAuthCodeUseCase {
  constructor(
    @Inject(GOOGLE_AUTH_CODE_EXCHANGER_PORT)
    private readonly exchanger: GoogleAuthCodeExchangerPort,
  ) {}

  async execute(input: ExchangeGoogleAuthCodeInput): Promise<TokenSet> {
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
    return this.exchanger.exchange(input);
  }
}
