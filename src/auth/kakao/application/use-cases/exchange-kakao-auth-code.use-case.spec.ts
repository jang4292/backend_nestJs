import { ExchangeKakaoAuthCodeUseCase } from './exchange-kakao-auth-code.use-case';
import {
  KAKAO_OAUTH_PORT,
  KakaoAccessTokenSet,
  KakaoOAuthPort,
} from '../ports/kakao-oauth.port';
import {
  KakaoAuthError,
  KakaoAuthErrorCode,
} from '../../domain/kakao-auth.errors';
import { Test } from '@nestjs/testing';

describe('ExchangeKakaoAuthCodeUseCase', () => {
  let useCase: ExchangeKakaoAuthCodeUseCase;
  let oauth: jest.Mocked<KakaoOAuthPort>;

  const tokenSet: KakaoAccessTokenSet = { accessToken: 'access.token.value' };

  beforeEach(async () => {
    oauth = { exchange: jest.fn(), fetchProfile: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        ExchangeKakaoAuthCodeUseCase,
        { provide: KAKAO_OAUTH_PORT, useValue: oauth },
      ],
    }).compile();

    useCase = module.get(ExchangeKakaoAuthCodeUseCase);
  });

  it('should return access token set on successful exchange', async () => {
    oauth.exchange.mockResolvedValue(tokenSet);
    const result = await useCase.execute({
      code: 'auth-code',
      redirectUri: 'https://example.com/callback',
    });
    expect(result).toEqual(tokenSet);
  });

  it('should throw AUTH_KAKAO_STATE_MISMATCH when state does not match', async () => {
    await expect(
      useCase.execute({
        code: 'auth-code',
        redirectUri: 'https://example.com/callback',
        state: 'received-state',
        expectedState: 'original-state',
      }),
    ).rejects.toMatchObject({
      errorCode: KakaoAuthErrorCode.AUTH_KAKAO_STATE_MISMATCH,
    });
    expect(oauth.exchange.mock.calls).toHaveLength(0);
  });

  it('should propagate AUTH_KAKAO_EXCHANGE_FAILED from adapter', async () => {
    oauth.exchange.mockRejectedValue(
      new KakaoAuthError(
        KakaoAuthErrorCode.AUTH_KAKAO_EXCHANGE_FAILED,
        'exchange failed',
      ),
    );
    await expect(
      useCase.execute({
        code: 'bad-code',
        redirectUri: 'https://example.com/callback',
      }),
    ).rejects.toMatchObject({
      errorCode: KakaoAuthErrorCode.AUTH_KAKAO_EXCHANGE_FAILED,
    });
  });
});
