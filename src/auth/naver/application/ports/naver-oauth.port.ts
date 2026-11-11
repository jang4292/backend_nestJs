import { SocialIdentity } from '../../../../users/domain/social-identity';

export const NAVER_OAUTH_PORT = Symbol('NaverOAuthPort');

export interface NaverAccessTokenSet {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
}

export interface NaverOAuthPort {
  /** Exchange an authorization code for an access token. Throws {@link NaverAuthError}. */
  exchange(params: {
    code: string;
    redirectUri: string;
    state?: string;
    expectedState?: string;
  }): Promise<NaverAccessTokenSet>;

  /** Fetch the Naver profile for a valid access token. Throws {@link NaverAuthError}. */
  fetchProfile(accessToken: string): Promise<SocialIdentity>;
}
