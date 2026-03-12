import { ExchangeGoogleAuthCodeUseCase } from './exchange-google-auth-code.use-case';
import {
  GOOGLE_AUTH_CODE_EXCHANGER_PORT,
  GoogleAuthCodeExchangerPort,
  TokenSet,
} from '../ports/google-auth-code-exchanger.port';
import { GoogleAuthError, GoogleAuthErrorCode } from '../../domain/google-auth.errors';
import { Test } from '@nestjs/testing';

describe('ExchangeGoogleAuthCodeUseCase', () => {
  let useCase: ExchangeGoogleAuthCodeUseCase;
  let exchanger: jest.Mocked<GoogleAuthCodeExchangerPort>;

  const tokenSet: TokenSet = {
    idToken: 'id.token.value',
    accessToken: 'access.token.value',
  };

  beforeEach(async () => {
    exchanger = { exchange: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        ExchangeGoogleAuthCodeUseCase,
        { provide: GOOGLE_AUTH_CODE_EXCHANGER_PORT, useValue: exchanger },
      ],
    }).compile();

    useCase = module.get(ExchangeGoogleAuthCodeUseCase);
  });

  it('should return TokenSet on successful exchange', async () => {
    exchanger.exchange.mockResolvedValue(tokenSet);
    const result = await useCase.execute({
      code: 'auth-code',
      redirectUri: 'https://example.com/callback',
    });
    expect(result).toEqual(tokenSet);
  });

  it('should throw AUTH_GOOGLE_STATE_MISMATCH when state does not match', async () => {
    await expect(
      useCase.execute({
        code: 'auth-code',
        redirectUri: 'https://example.com/callback',
        state: 'received-state',
        expectedState: 'original-state',
      }),
    ).rejects.toMatchObject({ errorCode: GoogleAuthErrorCode.AUTH_GOOGLE_STATE_MISMATCH });
    expect(exchanger.exchange).not.toHaveBeenCalled();
  });

  it('should proceed when state matches', async () => {
    exchanger.exchange.mockResolvedValue(tokenSet);
    const result = await useCase.execute({
      code: 'auth-code',
      redirectUri: 'https://example.com/callback',
      state: 'same-state',
      expectedState: 'same-state',
    });
    expect(result).toEqual(tokenSet);
  });

  it('should propagate AUTH_GOOGLE_EXCHANGE_FAILED from adapter', async () => {
    exchanger.exchange.mockRejectedValue(
      new GoogleAuthError(GoogleAuthErrorCode.AUTH_GOOGLE_EXCHANGE_FAILED, 'exchange failed'),
    );
    await expect(
      useCase.execute({ code: 'bad-code', redirectUri: 'https://example.com/callback' }),
    ).rejects.toMatchObject({ errorCode: GoogleAuthErrorCode.AUTH_GOOGLE_EXCHANGE_FAILED });
  });
});
