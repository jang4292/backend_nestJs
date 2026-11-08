import { NaverLoginUseCase } from './naver-login.use-case';
import {
  NAVER_OAUTH_PORT,
  NaverAccessTokenSet,
  NaverOAuthPort,
} from '../ports/naver-oauth.port';
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
import { NaverAuthErrorCode } from '../../domain/naver-auth.errors';
import { NAVER_LOGIN_POLICY } from '../naver-login.policy';
import type { NaverLoginPolicy } from '../naver-login.policy';
import { SocialIdentity } from '../../../../users/domain/social-identity';
import { Test } from '@nestjs/testing';

describe('NaverLoginUseCase', () => {
  let useCase: NaverLoginUseCase;
  let oauth: jest.Mocked<NaverOAuthPort>;
  let userRepo: jest.Mocked<SocialAccountLinkerPort>;
  let sessionIssuer: jest.Mocked<SessionIssuerPort>;
  let policy: NaverLoginPolicy;

  const identity: SocialIdentity = {
    provider: 'naver',
    sub: '987654321',
    email: 'user@example.com',
  };
  const userRecord: SocialUserRecord = {
    id: 1,
    username: 'naver_987654321',
    email: 'user@example.com',
  };
  const tokens: SessionTokens = { accessToken: 'jwt.token', expiresIn: 3600 };
  const tokenSet: NaverAccessTokenSet = { accessToken: 'naver.access.token' };

  beforeEach(async () => {
    oauth = { exchange: jest.fn(), fetchProfile: jest.fn() };
    userRepo = { findBySocialId: jest.fn(), upsert: jest.fn() };
    sessionIssuer = { issue: jest.fn() };
    // accessToken flow 테스트를 위해 허용 상태로 시작하고, 차단 기본값은 아래에서 별도로 검증합니다.
    policy = { allowAccessTokenLogin: true };

    const module = await Test.createTestingModule({
      providers: [
        NaverLoginUseCase,
        { provide: NAVER_OAUTH_PORT, useValue: oauth },
        { provide: SOCIAL_ACCOUNT_LINKER_PORT, useValue: userRepo },
        { provide: SESSION_ISSUER_PORT, useValue: sessionIssuer },
        { provide: NAVER_LOGIN_POLICY, useValue: policy },
      ],
    }).compile();

    useCase = module.get(NaverLoginUseCase);
  });

  describe('accessToken login policy (default: disabled)', () => {
    it('rejects accessToken login when the policy disallows it, before calling Naver', async () => {
      policy.allowAccessTokenLogin = false;

      await expect(
        useCase.execute({ accessToken: 'client.supplied.token' }),
      ).rejects.toMatchObject({
        errorCode: NaverAuthErrorCode.AUTH_NAVER_BAD_REQUEST,
      });
      expect(oauth.fetchProfile).not.toHaveBeenCalled();
      expect(userRepo.upsert).not.toHaveBeenCalled();
    });

    it('still allows the authorization code flow when accessToken login is disabled', async () => {
      policy.allowAccessTokenLogin = false;
      oauth.exchange.mockResolvedValue(tokenSet);
      oauth.fetchProfile.mockResolvedValue(identity);
      userRepo.upsert.mockResolvedValue(userRecord);
      sessionIssuer.issue.mockResolvedValue(tokens);

      const result = await useCase.execute({
        code: 'auth-code',
        redirectUri: 'https://example.com/callback',
        state: 's',
        expectedState: 's',
      });
      expect(result.user).toEqual(userRecord);
    });
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

    it('should throw AUTH_NAVER_BAD_REQUEST when redirectUri is missing in code flow', async () => {
      await expect(
        useCase.execute({ code: 'auth-code' }),
      ).rejects.toMatchObject({
        errorCode: NaverAuthErrorCode.AUTH_NAVER_BAD_REQUEST,
      });
    });
  });

  describe('mutual exclusivity', () => {
    it('should throw AUTH_NAVER_BAD_REQUEST when both accessToken and code are provided', async () => {
      await expect(
        useCase.execute({ accessToken: 'token', code: 'code' }),
      ).rejects.toMatchObject({
        errorCode: NaverAuthErrorCode.AUTH_NAVER_BAD_REQUEST,
      });
    });

    it('should throw AUTH_NAVER_BAD_REQUEST when neither accessToken nor code is provided', async () => {
      await expect(useCase.execute({})).rejects.toMatchObject({
        errorCode: NaverAuthErrorCode.AUTH_NAVER_BAD_REQUEST,
      });
    });
  });
});
