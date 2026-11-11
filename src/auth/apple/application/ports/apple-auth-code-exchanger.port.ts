export const APPLE_AUTH_CODE_EXCHANGER_PORT = Symbol(
  'AppleAuthCodeExchangerPort',
);

export interface TokenSet {
  idToken: string;
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
}

export interface AppleAuthCodeExchangerPort {
  /**
   * Exchange an authorization code for tokens.
   * Throws {@link AppleAuthError} on failure.
   */
  exchange(params: {
    code: string;
    redirectUri: string;
    state?: string;
    expectedState?: string;
  }): Promise<TokenSet>;
}
