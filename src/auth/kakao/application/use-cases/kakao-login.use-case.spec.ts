import { KakaoLoginUseCase } from './kakao-login.use-case';
import {
  KAKAO_OAUTH_PORT,
  KakaoAccessTokenSet,
  KakaoOAuthPort,
} from '../ports/kakao-oauth.port';
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
import { KakaoAuthErrorCode } from '../../domain/kakao-auth.errors';
import { SocialIdentity } from '../../../../users/domain/social-identity';
import { Test } from '@nestjs/testing';

describe('KakaoLoginUseCase', () => {
  let useCase: KakaoLoginUseCase;
  let oauth: jest.Mocked<KakaoOAuthPort>;
  let userRepo: jest.Mocked<SocialAccountLinkerPort>;
  let sessionIssuer: jest.Mocked<SessionIssuerPort>;

  const identity: SocialIdentity = {
    provider: 'kakao',
    sub: '123456789',
    email: 'user@example.com',
  };
  const userRecord: SocialUserRecord = {
    id: 1,
    username: 'kakao_123456789',
    email: 'user@example.com',
  };
  const tokens: SessionTokens = { accessToken: 'jwt.token', expiresIn: 3600 };
  const tokenSet: KakaoAccessTokenSet = { accessToken: 'kakao.access.token' };

  beforeEach(async () => {
    oauth = { exchange: jest.fn(), fetchProfile: jest.fn() };
    userRepo = { findBySocialId: jest.fn(), upsert: jest.fn() };
    sessionIssuer = { issue: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        KakaoLoginUseCase,
        { provide: KAKAO_OAUTH_PORT, useValue: oauth },
        { provide: SOCIAL_ACCOUNT_LINKER_PORT, useValue: userRepo },
        { provide: SESSION_ISSUER_PORT, useValue: sessionIssuer },
      ],
    }).compile();

    useCase = module.get(KakaoLoginUseCase);
  });

  describe('accessToken flow', () => {
    it('should return user and session for a valid accessToken', async () => {
      oauth.fetchProfile.mockResolvedValue(identity);
      userRepo.upsert.mockResolvedValue(userRecord);
      sessionIssuer.issue.mockResolvedValue(tokens);

      const result = await useCase.execute({ accessToken: 'valid.token' });
      expect(result.user).toEqual(userRecord);
      expect(result.session).toEqual(tokens);
      expect(oauth.exchange.mock.calls).toHaveLength(0);
    });
  });

  describe('auth code flow', () => {
    it('should exchange code, fetch profile and return session', async () => {
      oauth.exchange.mockResolvedValue(tokenSet);
      oauth.fetchProfile.mockResolvedValue(identity);
      userRepo.upsert.mockResolvedValue(userRecord);
      sessionIssuer.issue.mockResolvedValue(tokens);

      const result = await useCase.execute({
        code: 'auth-code',
        redirectUri: 'https://example.com/callback',
      });
      expect(result.user).toEqual(userRecord);
      expect(result.session).toEqual(tokens);
    });

    it('should throw AUTH_KAKAO_BAD_REQUEST when redirectUri is missing in code flow', async () => {
      await expect(
        useCase.execute({ code: 'auth-code' }),
      ).rejects.toMatchObject({
        errorCode: KakaoAuthErrorCode.AUTH_KAKAO_BAD_REQUEST,
      });
    });
  });

  describe('mutual exclusivity', () => {
    it('should throw AUTH_KAKAO_BAD_REQUEST when both accessToken and code are provided', async () => {
      await expect(
        useCase.execute({ accessToken: 'token', code: 'code' }),
      ).rejects.toMatchObject({
        errorCode: KakaoAuthErrorCode.AUTH_KAKAO_BAD_REQUEST,
      });
    });

    it('should throw AUTH_KAKAO_BAD_REQUEST when neither accessToken nor code is provided', async () => {
      await expect(useCase.execute({})).rejects.toMatchObject({
        errorCode: KakaoAuthErrorCode.AUTH_KAKAO_BAD_REQUEST,
      });
    });
  });
});
