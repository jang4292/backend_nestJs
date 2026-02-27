import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AuthGoogleController } from './auth-google.controller';
import { VerifyGoogleIdTokenUseCase } from '../application/use-cases/verify-google-id-token.use-case';
import { ExchangeGoogleAuthCodeUseCase } from '../application/use-cases/exchange-google-auth-code.use-case';
import { GoogleLoginUseCase } from '../application/use-cases/google-login.use-case';
import { REQUEST_ID_PROVIDER_PORT } from '../application/ports/request-id-provider.port';
import { GOOGLE_TOKEN_VERIFIER_PORT } from '../application/ports/google-token-verifier.port';
import { GOOGLE_AUTH_CODE_EXCHANGER_PORT } from '../application/ports/google-auth-code-exchanger.port';
import { SOCIAL_USER_REPOSITORY_PORT } from '../application/ports/social-user-repository.port';
import { SESSION_ISSUER_PORT } from '../application/ports/session-issuer.port';
import { GoogleAuthError, GoogleAuthErrorCode } from '../domain/google-auth.errors';
import { SocialIdentity } from '../domain/social-identity';

describe('AuthGoogleController (integration)', () => {
  let app: INestApplication<App>;
  let verifyIdTokenUseCase: jest.Mocked<VerifyGoogleIdTokenUseCase>;
  let exchangeCodeUseCase: jest.Mocked<ExchangeGoogleAuthCodeUseCase>;
  let googleLoginUseCase: jest.Mocked<GoogleLoginUseCase>;

  const mockRequestIdProvider = { generate: jest.fn().mockReturnValue('test-request-id') };

  const mockVerifier = { verifyIdToken: jest.fn() };
  const mockExchanger = { exchange: jest.fn() };
  const mockUserRepo = { findBySocialId: jest.fn(), upsert: jest.fn() };
  const mockSessionIssuer = { issue: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthGoogleController],
      providers: [
        VerifyGoogleIdTokenUseCase,
        ExchangeGoogleAuthCodeUseCase,
        GoogleLoginUseCase,
        { provide: GOOGLE_TOKEN_VERIFIER_PORT, useValue: mockVerifier },
        { provide: GOOGLE_AUTH_CODE_EXCHANGER_PORT, useValue: mockExchanger },
        { provide: SOCIAL_USER_REPOSITORY_PORT, useValue: mockUserRepo },
        { provide: SESSION_ISSUER_PORT, useValue: mockSessionIssuer },
        { provide: REQUEST_ID_PROVIDER_PORT, useValue: mockRequestIdProvider },
      ],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    verifyIdTokenUseCase = module.get(VerifyGoogleIdTokenUseCase);
    exchangeCodeUseCase = module.get(ExchangeGoogleAuthCodeUseCase);
    googleLoginUseCase = module.get(GoogleLoginUseCase);
  });

  afterEach(async () => {
    jest.clearAllMocks();
    await app.close();
  });

  describe('POST /auth/google/verify-id-token', () => {
    const identity: SocialIdentity = {
      provider: 'google',
      sub: '117123456789',
      email: 'user@example.com',
    };

    it('should return 200 with identity on valid token', async () => {
      mockVerifier.verifyIdToken.mockResolvedValue(identity);
      const res = await request(app.getHttpServer())
        .post('/auth/google/verify-id-token')
        .send({ idToken: 'valid.token' })
        .expect(200);

      expect(res.body.ok).toBe(true);
      expect(res.body.data).toMatchObject({ sub: '117123456789' });
      expect(res.headers['x-request-id']).toBeDefined();
    });

    it('should return 401 when token is expired', async () => {
      mockVerifier.verifyIdToken.mockRejectedValue(
        new GoogleAuthError(GoogleAuthErrorCode.AUTH_GOOGLE_TOKEN_EXPIRED, 'Token has expired.'),
      );
      const res = await request(app.getHttpServer())
        .post('/auth/google/verify-id-token')
        .send({ idToken: 'expired.token' })
        .expect(401);

      expect(res.body.ok).toBe(false);
      expect(res.body.errorCode).toBe(GoogleAuthErrorCode.AUTH_GOOGLE_TOKEN_EXPIRED);
    });

    it('should return 400 when idToken is missing', async () => {
      await request(app.getHttpServer())
        .post('/auth/google/verify-id-token')
        .send({})
        .expect(400);
    });
  });

  describe('POST /auth/google/login', () => {
    it('should return 200 with accessToken on successful idToken login', async () => {
      mockVerifier.verifyIdToken.mockResolvedValue({
        provider: 'google',
        sub: '117123456789',
        email: 'user@example.com',
      });
      mockUserRepo.upsert.mockResolvedValue({
        id: 1,
        username: 'google_117123456789',
        email: 'user@example.com',
      });
      mockSessionIssuer.issue.mockResolvedValue({ accessToken: 'jwt.token', expiresIn: 3600 });

      const res = await request(app.getHttpServer())
        .post('/auth/google/login')
        .send({ idToken: 'valid.token' })
        .expect(200);

      expect(res.body.ok).toBe(true);
      expect(res.body.data.accessToken).toBe('jwt.token');
    });

    it('should return 400 when both idToken and code are provided', async () => {
      mockVerifier.verifyIdToken.mockRejectedValue(
        new GoogleAuthError(GoogleAuthErrorCode.AUTH_GOOGLE_BAD_REQUEST, 'Provide exactly one.'),
      );
      const res = await request(app.getHttpServer())
        .post('/auth/google/login')
        .send({ idToken: 'token', code: 'code' })
        .expect(400);

      expect(res.body.ok).toBe(false);
      expect(res.body.errorCode).toBe(GoogleAuthErrorCode.AUTH_GOOGLE_BAD_REQUEST);
    });

    it('should return 400 when neither idToken nor code is provided', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/google/login')
        .send({})
        .expect(400);

      expect(res.body).toBeDefined();
    });
  });

  describe('POST /auth/google/exchange-code', () => {
    it('should return 200 with tokenSet on successful code exchange', async () => {
      mockExchanger.exchange.mockResolvedValue({
        idToken: 'id.token',
        accessToken: 'access.token',
      });

      const res = await request(app.getHttpServer())
        .post('/auth/google/exchange-code')
        .send({ code: 'auth-code', redirectUri: 'https://example.com/callback' })
        .expect(200);

      expect(res.body.ok).toBe(true);
      expect(res.body.data.idToken).toBe('id.token');
    });

    it('should return 400 when code is missing', async () => {
      await request(app.getHttpServer())
        .post('/auth/google/exchange-code')
        .send({ redirectUri: 'https://example.com/callback' })
        .expect(400);
    });
  });
});
