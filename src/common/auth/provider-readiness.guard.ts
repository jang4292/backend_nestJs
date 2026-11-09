import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import {
  SOCIAL_PROVIDER_METADATA_KEY,
  SocialProviderName,
} from './social-provider-route.decorator';

const ENABLED_KEY_BY_PROVIDER: Readonly<Record<SocialProviderName, string>> = {
  google: 'AUTH_GOOGLE_ENABLED',
  apple: 'AUTH_APPLE_ENABLED',
  kakao: 'AUTH_KAKAO_ENABLED',
  naver: 'AUTH_NAVER_ENABLED',
  facebook: 'AUTH_FACEBOOK_ENABLED',
};

/**
 * 비활성 SNS provider의 라우트를 컨트롤러 실행 전에 503으로 막습니다.
 *
 * provider는 요청 경로가 아니라 `@SocialProviderRoute()` 메타데이터로 찾습니다.
 * 경로 정규식은 대소문자(`/auth/GOOGLE/login`), 전역 prefix, 버전 경로 같은 라우팅 정규화 차이로
 * 우회될 수 있습니다(SEC-17).
 */
@Injectable()
export class ProviderReadinessGuard implements CanActivate {
  constructor(
    private readonly configService: ConfigService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const provider = this.reflector.getAllAndOverride<
      SocialProviderName | undefined
    >(SOCIAL_PROVIDER_METADATA_KEY, [context.getHandler(), context.getClass()]);
    if (!provider) return true;

    const configKey = ENABLED_KEY_BY_PROVIDER[provider];
    const enabled = this.configService.get<boolean>(configKey, false);
    if (enabled === true) return true;

    throw new ServiceUnavailableException({
      errorCode: `AUTH_${provider.toUpperCase()}_DISABLED`,
      message: 'This authentication provider is not available.',
    });
  }
}
