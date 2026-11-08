import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

const PROVIDER_BY_PATH: Readonly<Record<string, string>> = {
  google: 'AUTH_GOOGLE_ENABLED',
  apple: 'AUTH_APPLE_ENABLED',
  kakao: 'AUTH_KAKAO_ENABLED',
  naver: 'AUTH_NAVER_ENABLED',
  facebook: 'AUTH_FACEBOOK_ENABLED',
};

@Injectable()
export class ProviderReadinessGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const provider = this.getProvider(request.path);
    if (!provider) return true;

    const configKey = PROVIDER_BY_PATH[provider];
    const enabled = this.configService.get<boolean>(configKey, false);
    if (enabled) return true;

    throw new ServiceUnavailableException({
      errorCode: `AUTH_${provider.toUpperCase()}_DISABLED`,
      message: 'This authentication provider is not available.',
    });
  }

  private getProvider(path: string): string | undefined {
    const match = /^\/auth\/([^/]+)/.exec(path);
    const provider = match?.[1];
    return provider && provider in PROVIDER_BY_PATH ? provider : undefined;
  }
}
