import { Inject, Injectable } from '@nestjs/common';
import {
  AppleAuthErrorCode,
  AppleAuthError,
} from '../../domain/apple-auth.errors';
import { APPLE_AUTH_CODE_EXCHANGER_PORT } from '../ports/apple-auth-code-exchanger.port';
import type {
  AppleAuthCodeExchangerPort,
  TokenSet,
} from '../ports/apple-auth-code-exchanger.port';

export interface ExchangeAppleAuthCodeInput {
  code: string;
  redirectUri: string;
  state?: string;
  expectedState?: string;
}

@Injectable()
export class ExchangeAppleAuthCodeUseCase {
  constructor(
    @Inject(APPLE_AUTH_CODE_EXCHANGER_PORT)
    private readonly exchanger: AppleAuthCodeExchangerPort,
  ) {}

  async execute(input: ExchangeAppleAuthCodeInput): Promise<TokenSet> {
    if (
      input.state !== undefined &&
      input.expectedState !== undefined &&
      input.state !== input.expectedState
    ) {
      throw new AppleAuthError(
        AppleAuthErrorCode.AUTH_APPLE_STATE_MISMATCH,
        'State parameter mismatch – possible CSRF attack.',
      );
    }
    return this.exchanger.exchange(input);
  }
}
