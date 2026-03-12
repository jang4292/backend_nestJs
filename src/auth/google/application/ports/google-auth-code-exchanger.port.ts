export const GOOGLE_AUTH_CODE_EXCHANGER_PORT = Symbol(
  'GoogleAuthCodeExchangerPort',
);

export interface TokenSet {
  idToken: string;
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
}

export interface GoogleAuthCodeExchangerPort {
  /**
   * Exchange an authorization code for tokens.
   * Throws {@link GoogleAuthError} on failure.
   */
  exchange(params: {
    code: string;
    redirectUri: string;
    codeVerifier?: string;
    state?: string;
    expectedState?: string;
  }): Promise<TokenSet>;
}
