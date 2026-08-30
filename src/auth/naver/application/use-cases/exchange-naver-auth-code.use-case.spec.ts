import { ExchangeNaverAuthCodeUseCase } from './exchange-naver-auth-code.use-case';
import {
  NAVER_OAUTH_PORT,
  NaverAccessTokenSet,
  NaverOAuthPort,
} from '../ports/naver-oauth.port';
import {
  NaverAuthError,
  NaverAuthErrorCode,
} from '../../domain/naver-auth.errors';
import { Test } from '@nestjs/testing';

describe('ExchangeNaverAuthCodeUseCase', () => {
  let useCase: ExchangeNaverAuthCodeUseCase;
  let oauth: jest.Mocked<NaverOAuthPort>;

  const tokenSet: NaverAccessTokenSet = { accessToken: 'access.token.value' };

  beforeEach(async () => {
    oauth = { exchange: jest.fn(), fetchProfile: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        ExchangeNaverAuthCodeUseCase,
        { provide: NAVER_OAUTH_PORT, useValue: oauth },
      ],
    }).compile();

    useCase = module.get(ExchangeNaverAuthCodeUseCase);
  });

  it('should return access token set on successful exchange', async () => {
    oauth.exchange.mockResolvedValue(tokenSet);
    const result = await useCase.execute({
      code: 'auth-code',
      redirectUri: 'https://example.com/callback',
    });
    expect(result).toEqual(tokenSet);
  });

  it('should throw AUTH_NAVER_STATE_MISMATCH when state does not match', async () => {
    await expect(
      useCase.execute({
        code: 'auth-code',
        redirectUri: 'https://example.com/callback',
        state: 'received-state',
        expectedState: 'original-state',
      }),
    ).rejects.toMatchObject({
      errorCode: NaverAuthErrorCode.AUTH_NAVER_STATE_MISMATCH,
    });
    expect(oauth.exchange.mock.calls).toHaveLength(0);
  });

  it('should propagate AUTH_NAVER_EXCHANGE_FAILED from adapter', async () => {
    oauth.exchange.mockRejectedValue(
      new NaverAuthError(
        NaverAuthErrorCode.AUTH_NAVER_EXCHANGE_FAILED,
        'exchange failed',
      ),
    );
    await expect(
      useCase.execute({
        code: 'bad-code',
        redirectUri: 'https://example.com/callback',
      }),
    ).rejects.toMatchObject({
      errorCode: NaverAuthErrorCode.AUTH_NAVER_EXCHANGE_FAILED,
    });
  });
});
