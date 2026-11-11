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

  /**
   * 클라이언트가 보낸 accessToken이 이 앱에서 발급되었는지 검증합니다(app_id 비교).
   * 서버가 code 교환으로 직접 받은 토큰에는 호출할 필요가 없습니다. Throws {@link KakaoAuthError}.
   */
  verifyAccessTokenAudience(accessToken: string): Promise<void>;

  /** Fetch the Kakao profile for a valid access token. Throws {@link KakaoAuthError}. */
  fetchProfile(accessToken: string): Promise<SocialIdentity>;
}
