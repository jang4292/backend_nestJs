/**
 * SNS 로그인 요청 필드의 길이 상한(SEC-18). 정상 값보다 넉넉하게 두되, 비정상적으로 큰 입력이
 * provider 호출이나 로그로 흘러가지 않게 합니다.
 */
/** ID token, access token (JWT 또는 불투명 토큰) */
export const SOCIAL_TOKEN_MAX_LENGTH = 4096;
/** authorization code */
export const AUTH_CODE_MAX_LENGTH = 2048;
export const REDIRECT_URI_MAX_LENGTH = 2048;
export const OAUTH_STATE_MAX_LENGTH = 512;
export const OIDC_NONCE_MAX_LENGTH = 512;
/** RFC 7636: code_verifier는 43~128자 */
export const PKCE_VERIFIER_MAX_LENGTH = 128;
export const SOCIAL_PROFILE_NAME_MAX_LENGTH = 100;
export const SOCIAL_EMAIL_MAX_LENGTH = 255;
