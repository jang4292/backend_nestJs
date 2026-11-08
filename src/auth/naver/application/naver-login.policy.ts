export const NAVER_LOGIN_POLICY = Symbol('NaverLoginPolicy');

/**
 * Naver 로그인 정책. 모듈이 환경변수(AUTH_NAVER_ACCESS_TOKEN_LOGIN_ENABLED)에서 만들어 주입하므로
 * use-case는 ConfigService를 알지 않습니다.
 */
export interface NaverLoginPolicy {
  /**
   * 클라이언트가 보낸 Naver accessToken으로 로그인을 허용할지 여부.
   * Naver는 토큰의 발급 앱(client_id)을 검증하는 API를 확인하지 못해, 다른 앱에서 받은 토큰으로
   * 로그인하는 토큰 치환을 막을 수 없습니다. 기본값은 false(서버가 code를 교환하는 흐름만 허용)입니다.
   */
  allowAccessTokenLogin: boolean;
}
