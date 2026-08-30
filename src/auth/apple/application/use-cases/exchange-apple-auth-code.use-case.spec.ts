import { ExchangeAppleAuthCodeUseCase } from './exchange-apple-auth-code.use-case';
import {
  APPLE_AUTH_CODE_EXCHANGER_PORT,
  AppleAuthCodeExchangerPort,
  TokenSet,
} from '../ports/apple-auth-code-exchanger.port';
import {
  AppleAuthError,
  AppleAuthErrorCode,
} from '../../domain/apple-auth.errors';
import { Test } from '@nestjs/testing';

describe('ExchangeAppleAuthCodeUseCase', () => {
  let useCase: ExchangeAppleAuthCodeUseCase;
  let exchanger: jest.Mocked<AppleAuthCodeExchangerPort>;

  const tokenSet: TokenSet = {
    idToken: 'id.token.value',
    accessToken: 'access.token.value',
  };

  beforeEach(async () => {
    exchanger = { exchange: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        ExchangeAppleAuthCodeUseCase,
        { provide: APPLE_AUTH_CODE_EXCHANGER_PORT, useValue: exchanger },
      ],
    }).compile();

    useCase = module.get(ExchangeAppleAuthCodeUseCase);
  });

  it('should return TokenSet on successful exchange', async () => {
    exchanger.exchange.mockResolvedValue(tokenSet);
    const result = await useCase.execute({
      code: 'auth-code',
      redirectUri: 'https://example.com/callback',
    });
    expect(result).toEqual(tokenSet);
  });

  it('should throw AUTH_APPLE_STATE_MISMATCH when state does not match', async () => {
    await expect(
      useCase.execute({
        code: 'auth-code',
        redirectUri: 'https://example.com/callback',
        state: 'received-state',
        expectedState: 'original-state',
      }),
    ).rejects.toMatchObject({
      errorCode: AppleAuthErrorCode.AUTH_APPLE_STATE_MISMATCH,
    });
    expect(exchanger.exchange.mock.calls).toHaveLength(0);
  });

  it('should propagate AUTH_APPLE_EXCHANGE_FAILED from adapter', async () => {
    exchanger.exchange.mockRejectedValue(
      new AppleAuthError(
        AppleAuthErrorCode.AUTH_APPLE_EXCHANGE_FAILED,
        'exchange failed',
      ),
    );
    await expect(
      useCase.execute({
        code: 'bad-code',
        redirectUri: 'https://example.com/callback',
      }),
    ).rejects.toMatchObject({
      errorCode: AppleAuthErrorCode.AUTH_APPLE_EXCHANGE_FAILED,
    });
  });
});
