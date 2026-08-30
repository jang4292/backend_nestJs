import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { CommonModule } from '../../../common/common.module';
import { AuthGoogleController } from './auth-google.controller';
import { VerifyGoogleIdTokenUseCase } from '../application/use-cases/verify-google-id-token.use-case';
import { ExchangeGoogleAuthCodeUseCase } from '../application/use-cases/exchange-google-auth-code.use-case';
import { GoogleLoginUseCase } from '../application/use-cases/google-login.use-case';
import { GOOGLE_TOKEN_VERIFIER_PORT } from '../application/ports/google-token-verifier.port';
import { GOOGLE_AUTH_CODE_EXCHANGER_PORT } from '../application/ports/google-auth-code-exchanger.port';
import { SOCIAL_ACCOUNT_LINKER_PORT } from '../../../users/application/ports/social-account-linker.port';
import { SESSION_ISSUER_PORT } from '../../session/application/ports/session-issuer.port';
import {
  GoogleAuthError,
  GoogleAuthErrorCode,
} from '../domain/google-auth.errors';
import { SocialIdentity } from '../../../users/domain/social-identity';
import { GoogleAuthExceptionFilter } from './google-auth-exception.filter';

interface SuccessEnvelope<T> {
  ok: true;
  requestId: string;
  data: T;
}

interface ErrorEnvelope {
  ok: false;
  requestId: string;
  errorCode: string;
  message: string;
}

describe('AuthGoogleController (integration)', () => {
  let app: INestApplication<App>;

  const mockVerifier = { verifyIdToken: jest.fn() };
  const mockExchanger = { exchange: jest.fn() };
  const mockUserRepo = { findBySocialId: jest.fn(), upsert: jest.fn() };
  const mockSessionIssuer = { issue: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [CommonModule],
      controllers: [AuthGoogleController],
      providers: [
        VerifyGoogleIdTokenUseCase,
        ExchangeGoogleAuthCodeUseCase,
        GoogleLoginUseCase,
        { provide: GOOGLE_TOKEN_VERIFIER_PORT, useValue: mockVerifier },
        { provide: GOOGLE_AUTH_CODE_EXCHANGER_PORT, useValue: mockExchanger },
        { provide: SOCIAL_ACCOUNT_LINKER_PORT, useValue: mockUserRepo },
        { provide: SESSION_ISSUER_PORT, useValue: mockSessionIssuer },
        GoogleAuthExceptionFilter,
      ],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
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
      const body = res.body as SuccessEnvelope<SocialIdentity>;

      expect(body.ok).toBe(true);
      expect(body.data).toMatchObject({ sub: '117123456789' });
      expect(res.headers['x-request-id']).toBeDefined();
    });

    it('should return 401 when token is expired', async () => {
      mockVerifier.verifyIdToken.mockRejectedValue(
        new GoogleAuthError(
          GoogleAuthErrorCode.AUTH_GOOGLE_TOKEN_EXPIRED,
          'Token has expired.',
        ),
      );
      const res = await request(app.getHttpServer())
        .post('/auth/google/verify-id-token')
        .send({ idToken: 'expired.token' })
        .expect(401);
      const body = res.body as ErrorEnvelope;

      expect(body.ok).toBe(false);
      expect(body.errorCode).toBe(
        GoogleAuthErrorCode.AUTH_GOOGLE_TOKEN_EXPIRED,
      );
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
      mockSessionIssuer.issue.mockResolvedValue({
        accessToken: 'jwt.token',
        expiresIn: 3600,
      });

      const res = await request(app.getHttpServer())
        .post('/auth/google/login')
        .send({ idToken: 'valid.token' })
        .expect(200);
      const body = res.body as SuccessEnvelope<{
        accessToken: string;
      }>;

      expect(body.ok).toBe(true);
      expect(body.data.accessToken).toBe('jwt.token');
    });

    it('should return 400 when both idToken and code are provided', async () => {
      mockVerifier.verifyIdToken.mockRejectedValue(
        new GoogleAuthError(
          GoogleAuthErrorCode.AUTH_GOOGLE_BAD_REQUEST,
          'Provide exactly one.',
        ),
      );
      const res = await request(app.getHttpServer())
        .post('/auth/google/login')
        .send({ idToken: 'token', code: 'code' })
        .expect(400);
      const body = res.body as ErrorEnvelope;

      expect(body.ok).toBe(false);
      expect(body.errorCode).toBe(GoogleAuthErrorCode.AUTH_GOOGLE_BAD_REQUEST);
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
        .send({
          code: 'auth-code',
          redirectUri: 'https://example.com/callback',
        })
        .expect(200);
      const body = res.body as SuccessEnvelope<{
        idToken: string;
      }>;

      expect(body.ok).toBe(true);
      expect(body.data.idToken).toBe('id.token');
    });

    it('should return 400 when code is missing', async () => {
      await request(app.getHttpServer())
        .post('/auth/google/exchange-code')
        .send({ redirectUri: 'https://example.com/callback' })
        .expect(400);
    });
  });
});
