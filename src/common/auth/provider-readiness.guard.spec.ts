import { ServiceUnavailableException } from '@nestjs/common';
import { ProviderReadinessGuard } from './provider-readiness.guard';

describe('ProviderReadinessGuard', () => {
  const contextFor = (path: string) =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ path }),
      }),
    }) as never;

  it('allows non-provider routes', () => {
    const guard = new ProviderReadinessGuard({
      get: jest.fn(),
    } as never);

    expect(guard.canActivate(contextFor('/health'))).toBe(true);
  });

  it('blocks a disabled provider before controller execution', () => {
    const guard = new ProviderReadinessGuard({
      get: jest.fn().mockReturnValue(false),
    } as never);

    let thrown: unknown;
    try {
      guard.canActivate(contextFor('/auth/google/login'));
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(ServiceUnavailableException);
    expect(thrown).toEqual(
      expect.objectContaining({
        response: {
          errorCode: 'AUTH_GOOGLE_DISABLED',
          message: 'This authentication provider is not available.',
        },
      }),
    );
  });

  it('allows an enabled provider', () => {
    const guard = new ProviderReadinessGuard({
      get: jest.fn().mockReturnValue(true),
    } as never);

    expect(guard.canActivate(contextFor('/auth/google/login'))).toBe(true);
  });
});
