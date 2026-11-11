import type { SocialIdentity } from './social-identity';

/** SNS 최초 로그인 시 생성되는 username 접두사: `${provider}_${sub}` */
const SOCIAL_PROVIDERS: ReadonlyArray<SocialIdentity['provider']> = [
  'google',
  'apple',
  'facebook',
  'kakao',
  'naver',
];

export function socialUsername(
  provider: SocialIdentity['provider'],
  sub: string,
): string {
  return `${provider}_${sub}`;
}

/**
 * 로컬 가입이 SNS 계정용 username을 선점하면 해당 SNS 사용자의 최초 로그인이 막히므로
 * `<provider>_` 접두사는 로컬 가입에 사용할 수 없습니다.
 */
export function isReservedUsername(username: string): boolean {
  const normalized = username.toLowerCase();
  return SOCIAL_PROVIDERS.some((provider) =>
    normalized.startsWith(`${provider}_`),
  );
}
