import { ExchangeFacebookAuthCodeUseCase } from './exchange-facebook-auth-code.use-case';
import {
  FACEBOOK_OAUTH_PORT,
  FacebookAccessTokenSet,
  FacebookOAuthPort,
} from '../ports/facebook-oauth.port';
import {
  FacebookAuthError,
  FacebookAuthErrorCode,
} from '../../domain/facebook-auth.errors';
import { Test } from '@nestjs/testing';

describe('ExchangeFacebookAuthCodeUseCase', () => {
  let useCase: ExchangeFacebookAuthCodeUseCase;
  let oauth: jest.Mocked<FacebookOAuthPort>;

  const tokenSet: FacebookAccessTokenSet = {
    accessToken: 'access.token.value',
  };

  beforeEach(async () => {
    oauth = { exchange: jest.fn(), fetchProfile: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        ExchangeFacebookAuthCodeUseCase,
        { provide: FACEBOOK_OAUTH_PORT, useValue: oauth },
      ],
    }).compile();

    useCase = module.get(ExchangeFacebookAuthCodeUseCase);
  });

  it('should return access token set on successful exchange', async () => {
    oauth.exchange.mockResolvedValue(tokenSet);
    const result = await useCase.execute({
      code: 'auth-code',
      redirectUri: 'https://example.com/callback',
    });
    expect(result).toEqual(tokenSet);
  });

  it('should throw AUTH_FACEBOOK_STATE_MISMATCH when state does not match', async () => {
    await expect(
      useCase.execute({
        code: 'auth-code',
        redirectUri: 'https://example.com/callback',
        state: 'received-state',
        expectedState: 'original-state',
      }),
    ).rejects.toMatchObject({
      errorCode: FacebookAuthErrorCode.AUTH_FACEBOOK_STATE_MISMATCH,
    });
    expect(oauth.exchange.mock.calls).toHaveLength(0);
  });

  it('should propagate AUTH_FACEBOOK_EXCHANGE_FAILED from adapter', async () => {
    oauth.exchange.mockRejectedValue(
      new FacebookAuthError(
        FacebookAuthErrorCode.AUTH_FACEBOOK_EXCHANGE_FAILED,
        'exchange failed',
      ),
    );
    await expect(
      useCase.execute({
        code: 'bad-code',
        redirectUri: 'https://example.com/callback',
      }),
    ).rejects.toMatchObject({
      errorCode: FacebookAuthErrorCode.AUTH_FACEBOOK_EXCHANGE_FAILED,
    });
  });
});
