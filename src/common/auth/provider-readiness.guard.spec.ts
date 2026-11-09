import { ServiceUnavailableException } from '@nestjs/common';
import { PATH_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { AppController } from '../../app.controller';
import { AuthAppleController } from '../../auth/apple/interface/auth-apple.controller';
import { AuthFacebookController } from '../../auth/facebook/interface/auth-facebook.controller';
import { AuthGoogleController } from '../../auth/google/interface/auth-google.controller';
import { AuthKakaoController } from '../../auth/kakao/interface/auth-kakao.controller';
import { AuthLocalController } from '../../auth/local/interface/auth-local.controller';
import { AuthNaverController } from '../../auth/naver/interface/auth-naver.controller';
import { ProviderReadinessGuard } from './provider-readiness.guard';
import {
  SOCIAL_PROVIDER_METADATA_KEY,
  SOCIAL_PROVIDERS,
  SocialProviderName,
} from './social-provider-route.decorator';

type ControllerClass = { prototype: object; name: string };

const SOCIAL_CONTROLLERS: ReadonlyArray<[SocialProviderName, ControllerClass]> =
  [
    ['google', AuthGoogleController],
    ['apple', AuthAppleController],
    ['kakao', AuthKakaoController],
    ['naver', AuthNaverController],
    ['facebook', AuthFacebookController],
  ];

/** 실제 컨트롤러의 첫 번째 라우트 핸들러로 ExecutionContext를 만듭니다. 요청 경로는 판정에 쓰이지 않습니다. */
function contextFor(controller: ControllerClass, path = '/any') {
  const proto = controller.prototype as Record<string, unknown>;
  const handlerName = Object.getOwnPropertyNames(proto).find(
    (name) =>
      name !== 'constructor' &&
      typeof proto[name] === 'function' &&
      Reflect.getMetadata(PATH_METADATA, proto[name] as object) !== undefined,
  );
  if (!handlerName) {
    throw new Error(`${controller.name} has no route handler`);
  }
  return {
    getHandler: () => proto[handlerName],
    getClass: () => controller,
    switchToHttp: () => ({ getRequest: () => ({ path }) }),
  } as never;
}

function guardWith(enabled: boolean | undefined) {
  return new ProviderReadinessGuard(
    { get: jest.fn().mockReturnValue(enabled) } as never,
    new Reflector(),
  );
}

describe('ProviderReadinessGuard', () => {
  it('allows routes without a social provider (health, local login)', () => {
    const guard = guardWith(false);

    expect(guard.canActivate(contextFor(AppController, '/health'))).toBe(true);
    expect(
      guard.canActivate(contextFor(AuthLocalController, '/auth/login')),
    ).toBe(true);
  });

  it.each(SOCIAL_CONTROLLERS)(
    'blocks disabled %s before controller execution',
    (provider, controller) => {
      const guard = guardWith(false);

      let thrown: unknown;
      try {
        guard.canActivate(contextFor(controller, `/auth/${provider}/login`));
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(ServiceUnavailableException);
      expect(thrown).toEqual(
        expect.objectContaining({
          response: {
            errorCode: `AUTH_${provider.toUpperCase()}_DISABLED`,
            message: 'This authentication provider is not available.',
          },
        }),
      );
    },
  );

  // SEC-17: Express 라우팅은 대소문자를 구분하지 않으므로 /auth/GOOGLE/login도 Google 컨트롤러에 도달합니다.
  it.each([
    '/auth/GOOGLE/login',
    '/auth/Google/verify-id-token',
    '/AUTH/google/login',
  ])('blocks a disabled provider regardless of path spelling (%s)', (path) => {
    const guard = guardWith(false);

    expect(() =>
      guard.canActivate(contextFor(AuthGoogleController, path)),
    ).toThrow(ServiceUnavailableException);
  });

  it('treats a missing flag as disabled', () => {
    const guard = guardWith(undefined);

    expect(() => guard.canActivate(contextFor(AuthKakaoController))).toThrow(
      ServiceUnavailableException,
    );
  });

  it('allows an enabled provider', () => {
    const guard = guardWith(true);

    expect(guard.canActivate(contextFor(AuthGoogleController))).toBe(true);
  });
});

describe('SNS controllers declare their provider', () => {
  it('covers every supported provider', () => {
    expect(SOCIAL_CONTROLLERS.map(([provider]) => provider).sort()).toEqual(
      [...SOCIAL_PROVIDERS].sort(),
    );
  });

  // 새 SNS 컨트롤러에 @SocialProviderRoute를 빠뜨리면 비활성 상태에서도 열리므로 실패시킵니다.
  it.each(SOCIAL_CONTROLLERS)(
    '%s controller has @SocialProviderRoute',
    (provider, controller) => {
      expect(
        Reflect.getMetadata(SOCIAL_PROVIDER_METADATA_KEY, controller),
      ).toBe(provider);
    },
  );
});
