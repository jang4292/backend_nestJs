/**
 * 로컬 계정 입력 정책(SEC-18). DTO와 문서가 같은 값을 쓰도록 한곳에 둡니다.
 *
 * - 새 비밀번호: 8자 이상, UTF-8 72바이트 이하. bcrypt는 72바이트 이후를 무시하므로
 *   그보다 긴 비밀번호는 앞 72바이트만 같아도 같은 비밀번호로 취급됩니다.
 * - 로그인·현재 비밀번호 확인: 72바이트 제한을 두지 않습니다. 정책 이전에 긴 비밀번호로 가입한
 *   사용자도 로그인할 수 있어야 하며, 요청 크기만 제한합니다.
 */
export const USERNAME_MIN_LENGTH = 4;
export const USERNAME_MAX_LENGTH = 50;
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_BYTES = 72;
export const PASSWORD_INPUT_MAX_LENGTH = 1024;
export const LOGIN_IDENTIFIER_MAX_LENGTH = 255;
export const EMAIL_MAX_LENGTH = 255;
export const NAME_MAX_LENGTH = 100;
