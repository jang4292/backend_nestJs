import { VerifyGoogleIdTokenUseCase } from './verify-google-id-token.use-case';
import {
  GoogleTokenVerifierPort,
  GOOGLE_TOKEN_VERIFIER_PORT,
} from '../ports/google-token-verifier.port';
import { GoogleAuthError, GoogleAuthErrorCode } from '../../domain/google-auth.errors';
import { SocialIdentity } from '../../domain/social-identity';
import { Test } from '@nestjs/testing';

describe('VerifyGoogleIdTokenUseCase', () => {
  let useCase: VerifyGoogleIdTokenUseCase;
  let verifier: jest.Mocked<GoogleTokenVerifierPort>;

  const validIdentity: SocialIdentity = {
    provider: 'google',
    sub: '117123456789',
    email: 'user@example.com',
    emailVerified: true,
    name: 'Test User',
  };

  beforeEach(async () => {
    verifier = { verifyIdToken: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        VerifyGoogleIdTokenUseCase,
        { provide: GOOGLE_TOKEN_VERIFIER_PORT, useValue: verifier },
      ],
    }).compile();

    useCase = module.get(VerifyGoogleIdTokenUseCase);
  });

  it('should return SocialIdentity on valid token', async () => {
    verifier.verifyIdToken.mockResolvedValue(validIdentity);
    const result = await useCase.execute({ idToken: 'valid.token' });
    expect(result).toEqual(validIdentity);
    expect(verifier.verifyIdToken).toHaveBeenCalledWith('valid.token', undefined);
  });

  it('should pass nonce to verifier when provided', async () => {
    verifier.verifyIdToken.mockResolvedValue(validIdentity);
    await useCase.execute({ idToken: 'valid.token', nonce: 'abc123' });
    expect(verifier.verifyIdToken).toHaveBeenCalledWith('valid.token', 'abc123');
  });

  it('should propagate AUTH_GOOGLE_INVALID_AUDIENCE error', async () => {
    verifier.verifyIdToken.mockRejectedValue(
      new GoogleAuthError(GoogleAuthErrorCode.AUTH_GOOGLE_INVALID_AUDIENCE, 'aud mismatch'),
    );
    await expect(useCase.execute({ idToken: 'bad.token' })).rejects.toMatchObject({
      errorCode: GoogleAuthErrorCode.AUTH_GOOGLE_INVALID_AUDIENCE,
    });
  });

  it('should propagate AUTH_GOOGLE_TOKEN_EXPIRED error', async () => {
    verifier.verifyIdToken.mockRejectedValue(
      new GoogleAuthError(GoogleAuthErrorCode.AUTH_GOOGLE_TOKEN_EXPIRED, 'token expired'),
    );
    await expect(useCase.execute({ idToken: 'expired.token' })).rejects.toMatchObject({
      errorCode: GoogleAuthErrorCode.AUTH_GOOGLE_TOKEN_EXPIRED,
    });
  });

  it('should propagate AUTH_GOOGLE_MISSING_SUB error', async () => {
    verifier.verifyIdToken.mockRejectedValue(
      new GoogleAuthError(GoogleAuthErrorCode.AUTH_GOOGLE_MISSING_SUB, 'missing sub'),
    );
    await expect(useCase.execute({ idToken: 'no.sub.token' })).rejects.toMatchObject({
      errorCode: GoogleAuthErrorCode.AUTH_GOOGLE_MISSING_SUB,
    });
  });

  it('should propagate AUTH_GOOGLE_INVALID_ISSUER error', async () => {
    verifier.verifyIdToken.mockRejectedValue(
      new GoogleAuthError(GoogleAuthErrorCode.AUTH_GOOGLE_INVALID_ISSUER, 'invalid issuer'),
    );
    await expect(useCase.execute({ idToken: 'bad.issuer.token' })).rejects.toMatchObject({
      errorCode: GoogleAuthErrorCode.AUTH_GOOGLE_INVALID_ISSUER,
    });
  });

  it('should propagate AUTH_GOOGLE_NONCE_MISMATCH error', async () => {
    verifier.verifyIdToken.mockRejectedValue(
      new GoogleAuthError(GoogleAuthErrorCode.AUTH_GOOGLE_NONCE_MISMATCH, 'nonce mismatch'),
    );
    await expect(
      useCase.execute({ idToken: 'token', nonce: 'wrong-nonce' }),
    ).rejects.toMatchObject({ errorCode: GoogleAuthErrorCode.AUTH_GOOGLE_NONCE_MISMATCH });
  });
});
