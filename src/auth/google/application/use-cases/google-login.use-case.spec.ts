import { GoogleLoginUseCase } from './google-login.use-case';
import {
  GOOGLE_TOKEN_VERIFIER_PORT,
  GoogleTokenVerifierPort,
} from '../ports/google-token-verifier.port';
import {
  GOOGLE_AUTH_CODE_EXCHANGER_PORT,
  GoogleAuthCodeExchangerPort,
  TokenSet,
} from '../ports/google-auth-code-exchanger.port';
import {
  SOCIAL_USER_REPOSITORY_PORT,
  SocialUserRecord,
  SocialUserRepositoryPort,
} from '../ports/social-user-repository.port';
import {
  SESSION_ISSUER_PORT,
  SessionIssuerPort,
  SessionTokens,
} from '../ports/session-issuer.port';
import { GoogleAuthErrorCode } from '../../domain/google-auth.errors';
import { SocialIdentity } from '../../domain/social-identity';
import { Test } from '@nestjs/testing';

describe('GoogleLoginUseCase', () => {
  let useCase: GoogleLoginUseCase;
  let verifier: jest.Mocked<GoogleTokenVerifierPort>;
  let exchanger: jest.Mocked<GoogleAuthCodeExchangerPort>;
  let userRepo: jest.Mocked<SocialUserRepositoryPort>;
  let sessionIssuer: jest.Mocked<SessionIssuerPort>;

  const identity: SocialIdentity = {
    provider: 'google',
    sub: '117123456789',
    email: 'user@example.com',
    name: 'Test User',
  };
  const userRecord: SocialUserRecord = {
    id: 1,
    username: 'google_117123456789',
    email: 'user@example.com',
  };
  const tokens: SessionTokens = { accessToken: 'jwt.token', expiresIn: 3600 };
  const tokenSet: TokenSet = { idToken: 'id.token' };

  beforeEach(async () => {
    verifier = { verifyIdToken: jest.fn() };
    exchanger = { exchange: jest.fn() };
    userRepo = { findBySocialId: jest.fn(), upsert: jest.fn() };
    sessionIssuer = { issue: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        GoogleLoginUseCase,
        { provide: GOOGLE_TOKEN_VERIFIER_PORT, useValue: verifier },
        { provide: GOOGLE_AUTH_CODE_EXCHANGER_PORT, useValue: exchanger },
        { provide: SOCIAL_USER_REPOSITORY_PORT, useValue: userRepo },
        { provide: SESSION_ISSUER_PORT, useValue: sessionIssuer },
      ],
    }).compile();

    useCase = module.get(GoogleLoginUseCase);
  });

  describe('idToken flow', () => {
    it('should return user and session on valid idToken', async () => {
      verifier.verifyIdToken.mockResolvedValue(identity);
      userRepo.upsert.mockResolvedValue(userRecord);
      sessionIssuer.issue.mockResolvedValue(tokens);

      const result = await useCase.execute({ idToken: 'valid.token' });
      expect(result.user).toEqual(userRecord);
      expect(result.session).toEqual(tokens);
      expect(exchanger.exchange.mock.calls).toHaveLength(0);
    });
  });

  describe('auth code flow', () => {
    it('should exchange code, verify idToken and return session', async () => {
      exchanger.exchange.mockResolvedValue(tokenSet);
      verifier.verifyIdToken.mockResolvedValue(identity);
      userRepo.upsert.mockResolvedValue(userRecord);
      sessionIssuer.issue.mockResolvedValue(tokens);

      const result = await useCase.execute({
        code: 'auth-code',
        redirectUri: 'https://example.com/callback',
      });
      expect(result.user).toEqual(userRecord);
      expect(result.session).toEqual(tokens);
      expect(exchanger.exchange.mock.calls[0]?.[0]).toEqual(
        expect.objectContaining({
          code: 'auth-code',
        }),
      );
    });

    it('should throw AUTH_GOOGLE_BAD_REQUEST when redirectUri is missing in code flow', async () => {
      await expect(
        useCase.execute({ code: 'auth-code' }),
      ).rejects.toMatchObject({
        errorCode: GoogleAuthErrorCode.AUTH_GOOGLE_BAD_REQUEST,
      });
    });

    it('should throw AUTH_GOOGLE_STATE_MISMATCH on state mismatch', async () => {
      await expect(
        useCase.execute({
          code: 'auth-code',
          redirectUri: 'https://example.com/callback',
          state: 'received',
          expectedState: 'original',
        }),
      ).rejects.toMatchObject({
        errorCode: GoogleAuthErrorCode.AUTH_GOOGLE_STATE_MISMATCH,
      });
    });
  });

  describe('mutual exclusivity', () => {
    it('should throw AUTH_GOOGLE_BAD_REQUEST when both idToken and code are provided', async () => {
      await expect(
        useCase.execute({ idToken: 'token', code: 'code' }),
      ).rejects.toMatchObject({
        errorCode: GoogleAuthErrorCode.AUTH_GOOGLE_BAD_REQUEST,
      });
    });

    it('should throw AUTH_GOOGLE_BAD_REQUEST when neither idToken nor code is provided', async () => {
      await expect(useCase.execute({})).rejects.toMatchObject({
        errorCode: GoogleAuthErrorCode.AUTH_GOOGLE_BAD_REQUEST,
      });
    });
  });
});
