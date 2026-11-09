import { ConfigService } from '@nestjs/config';
import { jwtVerify } from 'jose';
import { AppleAuthErrorCode } from '../domain/apple-auth.errors';
import { AppleJwksVerifierAdapter } from './apple-jwks-verifier.adapter';

// jose는 ESM 전용이라 unit 테스트에서는 모듈을 대체합니다. 여기서는 검증 호출 여부만 확인합니다.
jest.mock('jose', () => ({
  createRemoteJWKSet: jest.fn(() => jest.fn()),
  jwtVerify: jest.fn(),
}));

function verifierWith(config: Record<string, string | undefined>) {
  return new AppleJwksVerifierAdapter({
    get: (key: string, fallback?: string) => config[key] ?? fallback,
  } as unknown as ConfigService);
}

describe('AppleJwksVerifierAdapter fail-closed configuration', () => {
  const verify = jwtVerify as jest.MockedFunction<typeof jwtVerify>;

  beforeEach(() => verify.mockReset());

  // aud 없이 검증하면 다른 앱용 Apple 토큰도 통과하므로, 설정이 없으면 검증 전에 거부합니다.
  it('rejects ID tokens when APPLE_ALLOWED_AUDIENCES is empty', async () => {
    await expect(
      verifierWith({}).verifyIdToken('header.payload.signature'),
    ).rejects.toMatchObject({
      errorCode: AppleAuthErrorCode.AUTH_APPLE_CONFIG_MISSING,
    });
    expect(verify).not.toHaveBeenCalled();
  });

  it('passes the configured audiences to jose', async () => {
    verify.mockResolvedValue({
      payload: { sub: 'apple-sub', email: 'a@example.com' },
      protectedHeader: { alg: 'RS256' },
    });

    await expect(
      verifierWith({
        APPLE_ALLOWED_AUDIENCES: 'com.example.app',
      }).verifyIdToken('header.payload.signature'),
    ).resolves.toMatchObject({ provider: 'apple', sub: 'apple-sub' });
    expect(verify).toHaveBeenCalledWith(
      'header.payload.signature',
      expect.any(Function),
      expect.objectContaining({ audience: ['com.example.app'] }),
    );
  });
});
