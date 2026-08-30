import { VerifyAppleIdTokenUseCase } from './verify-apple-id-token.use-case';
import {
  AppleTokenVerifierPort,
  APPLE_TOKEN_VERIFIER_PORT,
} from '../ports/apple-token-verifier.port';
import {
  AppleAuthError,
  AppleAuthErrorCode,
} from '../../domain/apple-auth.errors';
import { SocialIdentity } from '../../../../users/domain/social-identity';
import { Test } from '@nestjs/testing';

describe('VerifyAppleIdTokenUseCase', () => {
  let useCase: VerifyAppleIdTokenUseCase;
  let verifier: jest.Mocked<AppleTokenVerifierPort>;

  const validIdentity: SocialIdentity = {
    provider: 'apple',
    sub: '001234.abcdef.5678',
    email: 'user@example.com',
    emailVerified: true,
  };

  beforeEach(async () => {
    verifier = { verifyIdToken: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        VerifyAppleIdTokenUseCase,
        { provide: APPLE_TOKEN_VERIFIER_PORT, useValue: verifier },
      ],
    }).compile();

    useCase = module.get(VerifyAppleIdTokenUseCase);
  });

  it('should return SocialIdentity on valid token', async () => {
    verifier.verifyIdToken.mockResolvedValue(validIdentity);
    const result = await useCase.execute({ idToken: 'valid.token' });
    expect(result).toEqual(validIdentity);
    expect(verifier.verifyIdToken.mock.calls[0]).toEqual([
      'valid.token',
      undefined,
    ]);
  });

  it('should propagate AUTH_APPLE_TOKEN_EXPIRED error', async () => {
    verifier.verifyIdToken.mockRejectedValue(
      new AppleAuthError(
        AppleAuthErrorCode.AUTH_APPLE_TOKEN_EXPIRED,
        'token expired',
      ),
    );
    await expect(
      useCase.execute({ idToken: 'expired.token' }),
    ).rejects.toMatchObject({
      errorCode: AppleAuthErrorCode.AUTH_APPLE_TOKEN_EXPIRED,
    });
  });

  it('should propagate AUTH_APPLE_MISSING_SUB error', async () => {
    verifier.verifyIdToken.mockRejectedValue(
      new AppleAuthError(
        AppleAuthErrorCode.AUTH_APPLE_MISSING_SUB,
        'missing sub',
      ),
    );
    await expect(
      useCase.execute({ idToken: 'no.sub.token' }),
    ).rejects.toMatchObject({
      errorCode: AppleAuthErrorCode.AUTH_APPLE_MISSING_SUB,
    });
  });
});
