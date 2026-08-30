import { AppleLoginUseCase } from './apple-login.use-case';
import {
  APPLE_TOKEN_VERIFIER_PORT,
  AppleTokenVerifierPort,
} from '../ports/apple-token-verifier.port';
import {
  APPLE_AUTH_CODE_EXCHANGER_PORT,
  AppleAuthCodeExchangerPort,
  TokenSet,
} from '../ports/apple-auth-code-exchanger.port';
import {
  SOCIAL_ACCOUNT_LINKER_PORT,
  SocialUserRecord,
  SocialAccountLinkerPort,
} from '../../../../users/application/ports/social-account-linker.port';
import {
  SESSION_ISSUER_PORT,
  SessionIssuerPort,
  SessionTokens,
} from '../../../session/application/ports/session-issuer.port';
import { AppleAuthErrorCode } from '../../domain/apple-auth.errors';
import { SocialIdentity } from '../../../../users/domain/social-identity';
import { Test } from '@nestjs/testing';

describe('AppleLoginUseCase', () => {
  let useCase: AppleLoginUseCase;
  let verifier: jest.Mocked<AppleTokenVerifierPort>;
  let exchanger: jest.Mocked<AppleAuthCodeExchangerPort>;
  let userRepo: jest.Mocked<SocialAccountLinkerPort>;
  let sessionIssuer: jest.Mocked<SessionIssuerPort>;

  const identity: SocialIdentity = {
    provider: 'apple',
    sub: '001234.abcdef.5678',
    email: 'user@example.com',
  };
  const userRecord: SocialUserRecord = {
    id: 1,
    username: 'apple_001234.abcdef.5678',
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
        AppleLoginUseCase,
        { provide: APPLE_TOKEN_VERIFIER_PORT, useValue: verifier },
        { provide: APPLE_AUTH_CODE_EXCHANGER_PORT, useValue: exchanger },
        { provide: SOCIAL_ACCOUNT_LINKER_PORT, useValue: userRepo },
        { provide: SESSION_ISSUER_PORT, useValue: sessionIssuer },
      ],
    }).compile();

    useCase = module.get(AppleLoginUseCase);
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

    it('should prefer client-supplied user info on first login', async () => {
      verifier.verifyIdToken.mockResolvedValue(identity);
      userRepo.upsert.mockResolvedValue(userRecord);
      sessionIssuer.issue.mockResolvedValue(tokens);

      await useCase.execute({
        idToken: 'valid.token',
        user: { name: 'First Login Name', email: 'first@example.com' },
      });
      expect(userRepo.upsert.mock.calls[0][0]).toMatchObject({
        name: 'First Login Name',
        email: 'first@example.com',
      });
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
    });

    it('should throw AUTH_APPLE_BAD_REQUEST when redirectUri is missing in code flow', async () => {
      await expect(
        useCase.execute({ code: 'auth-code' }),
      ).rejects.toMatchObject({
        errorCode: AppleAuthErrorCode.AUTH_APPLE_BAD_REQUEST,
      });
    });
  });

  describe('mutual exclusivity', () => {
    it('should throw AUTH_APPLE_BAD_REQUEST when both idToken and code are provided', async () => {
      await expect(
        useCase.execute({ idToken: 'token', code: 'code' }),
      ).rejects.toMatchObject({
        errorCode: AppleAuthErrorCode.AUTH_APPLE_BAD_REQUEST,
      });
    });

    it('should throw AUTH_APPLE_BAD_REQUEST when neither idToken nor code is provided', async () => {
      await expect(useCase.execute({})).rejects.toMatchObject({
        errorCode: AppleAuthErrorCode.AUTH_APPLE_BAD_REQUEST,
      });
    });
  });
});
