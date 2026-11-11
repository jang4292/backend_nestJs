import { SetMetadata } from '@nestjs/common';

export const SOCIAL_PROVIDERS = [
  'google',
  'apple',
  'kakao',
  'naver',
  'facebook',
] as const;

export type SocialProviderName = (typeof SOCIAL_PROVIDERS)[number];

export const SOCIAL_PROVIDER_METADATA_KEY = 'auth:social-provider';

/**
 * 이 컨트롤러(또는 핸들러)가 어느 SNS provider의 라우트인지 표시합니다.
 * ProviderReadinessGuard는 요청 경로가 아니라 이 메타데이터로 provider 활성 여부를 판정합니다.
 *
 * 경로 문자열로 판정하면 안 되는 이유: Express 라우팅은 기본적으로 대소문자를 구분하지 않아
 * `/auth/GOOGLE/login`도 Google 컨트롤러로 라우팅되지만, 경로 정규식 검사는 이를 놓칩니다(SEC-17).
 */
export const SocialProviderRoute = (provider: SocialProviderName) =>
  SetMetadata(SOCIAL_PROVIDER_METADATA_KEY, provider);
