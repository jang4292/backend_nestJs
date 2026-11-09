import { Test, TestingModule } from '@nestjs/testing';
import {
  RateLimitedError,
  UnauthorizedError,
} from '../../../../common/errors/domain-error';
import { UsersService } from '../../../../users/users.service';
import { LocalLoginUseCase } from './local-login.use-case';
import { LoginIdentifierType } from '../../../../users/domain/login-identifier-type.enum';
import { UserRole } from '../../../../users/domain/user-role.enum';
import { SESSION_ISSUER_PORT } from '../../../session/application/ports/session-issuer.port';
import type { SessionIssuerPort } from '../../../session/application/ports/session-issuer.port';
import type { User } from '../../../../users/entities/user.entity';
import { LOGIN_ATTEMPT_LIMITER_PORT } from '../ports/login-attempt-limiter.port';
import {
  InMemoryLoginAttemptLimiterAdapter,
  LOGIN_FAILURE_LIMIT,
} from '../../infrastructure/in-memory-login-attempt-limiter.adapter';

type UsersServiceMock = Pick<UsersService, 'verifyCredentials'>;

describe('LocalLoginUseCase', () => {
  let useCase: LocalLoginUseCase;
  let usersService: jest.Mocked<UsersServiceMock>;
  let sessionIssuer: jest.Mocked<SessionIssuerPort>;
  let attempts: InMemoryLoginAttemptLimiterAdapter;

  const user: User = {
    id: 1,
    username: 'testuser',
    email: 'test@example.com',
    name: 'Test User',
    role: UserRole.USER,
    sessionVersion: 0,
    socialAccounts: [],
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  beforeEach(async () => {
    usersService = { verifyCredentials: jest.fn() };
    sessionIssuer = {
      issue: jest
        .fn()
        .mockResolvedValue({ accessToken: 'signed.jwt', expiresIn: 3600 }),
    };

    attempts = new InMemoryLoginAttemptLimiterAdapter();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LocalLoginUseCase,
        { provide: UsersService, useValue: usersService },
        { provide: SESSION_ISSUER_PORT, useValue: sessionIssuer },
        { provide: LOGIN_ATTEMPT_LIMITER_PORT, useValue: attempts },
      ],
    }).compile();

    useCase = module.get(LocalLoginUseCase);
  });

  it('issues a session for valid credentials', async () => {
    usersService.verifyCredentials.mockResolvedValue(user);

    const result = await useCase.execute({
      identifierType: LoginIdentifierType.USERNAME,
      identifier: 'testuser',
      password: 'plain-password',
    });

    expect(usersService.verifyCredentials).toHaveBeenCalledWith(
      LoginIdentifierType.USERNAME,
      'testuser',
      'plain-password',
    );
    expect(sessionIssuer.issue).toHaveBeenCalledWith(user);
    expect(result.session.accessToken).toBe('signed.jwt');
    expect(result.user).toBe(user);
  });

  it('logs in with email identifier', async () => {
    usersService.verifyCredentials.mockResolvedValue(user);

    await useCase.execute({
      identifierType: LoginIdentifierType.EMAIL,
      identifier: 'test@example.com',
      password: 'plain-password',
    });

    expect(usersService.verifyCredentials).toHaveBeenCalledWith(
      LoginIdentifierType.EMAIL,
      'test@example.com',
      'plain-password',
    );
  });

  it('throws a 401 domain error when credentials are invalid or the user is missing', async () => {
    usersService.verifyCredentials.mockResolvedValue(null);

    await expect(
      useCase.execute({
        identifierType: LoginIdentifierType.USERNAME,
        identifier: 'testuser',
        password: 'wrong-password',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedError);
    expect(sessionIssuer.issue).not.toHaveBeenCalled();
  });

  // SEC-19: IP와 무관하게 같은 계정에 대한 실패가 쌓이면 비밀번호 검증 전에 429로 거부합니다.
  it('blocks an identifier after repeated failures, before checking the password', async () => {
    usersService.verifyCredentials.mockResolvedValue(null);
    const attempt = (identifier: string) =>
      useCase.execute({
        identifierType: LoginIdentifierType.USERNAME,
        identifier,
        password: 'wrong-password',
      });

    for (let i = 0; i < LOGIN_FAILURE_LIMIT; i += 1) {
      await expect(attempt('testuser')).rejects.toBeInstanceOf(
        UnauthorizedError,
      );
    }
    usersService.verifyCredentials.mockClear();

    // 대소문자·공백만 바꿔도 같은 계정으로 셉니다.
    await expect(attempt('  TestUser ')).rejects.toBeInstanceOf(
      RateLimitedError,
    );
    expect(usersService.verifyCredentials).not.toHaveBeenCalled();
  });

  it('clears the failure count after a successful login', async () => {
    usersService.verifyCredentials.mockResolvedValue(null);
    for (let i = 0; i < LOGIN_FAILURE_LIMIT - 1; i += 1) {
      await expect(
        useCase.execute({
          identifierType: LoginIdentifierType.USERNAME,
          identifier: 'testuser',
          password: 'wrong-password',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedError);
    }

    usersService.verifyCredentials.mockResolvedValue(user);
    await useCase.execute({
      identifierType: LoginIdentifierType.USERNAME,
      identifier: 'testuser',
      password: 'plain-password',
    });

    expect(attempts.size).toBe(0);
  });
});
