import { SocialIdentity } from '../../../../users/domain/social-identity';

export const KAKAO_OAUTH_PORT = Symbol('KakaoOAuthPort');

export interface KakaoAccessTokenSet {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
}

export interface KakaoOAuthPort {
  /** Exchange an authorization code for an access token. Throws {@link KakaoAuthError}. */
  exchange(params: {
    code: string;
    redirectUri: string;
    state?: string;
    expectedState?: string;
  }): Promise<KakaoAccessTokenSet>;

  /** Fetch the Kakao profile for a valid access token. Throws {@link KakaoAuthError}. */
  fetchProfile(accessToken: string): Promise<SocialIdentity>;
}
