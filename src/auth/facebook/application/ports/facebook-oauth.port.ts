import { SocialIdentity } from '../../../../users/domain/social-identity';

export const FACEBOOK_OAUTH_PORT = Symbol('FacebookOAuthPort');

export interface FacebookAccessTokenSet {
  accessToken: string;
  expiresIn?: number;
}

export interface FacebookOAuthPort {
  /** Exchange an authorization code for an access token. Throws {@link FacebookAuthError}. */
  exchange(params: {
    code: string;
    redirectUri: string;
    state?: string;
    expectedState?: string;
  }): Promise<FacebookAccessTokenSet>;

  /**
   * Validate a (possibly client-supplied) access token and fetch the profile.
   * Throws {@link FacebookAuthError} on failure.
   */
  fetchProfile(accessToken: string): Promise<SocialIdentity>;
}
