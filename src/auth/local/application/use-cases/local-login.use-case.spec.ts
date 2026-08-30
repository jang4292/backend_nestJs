import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from '../../../../users/users.service';
import { LocalLoginUseCase } from './local-login.use-case';
import { LoginIdentifierType } from '../../../../users/domain/login-identifier-type.enum';
import { SESSION_ISSUER_PORT } from '../../../session/application/ports/session-issuer.port';
import type { SessionIssuerPort } from '../../../session/application/ports/session-issuer.port';
import type { User } from '../../../../users/entities/user.entity';

type UsersServiceMock = Pick<
  UsersService,
  'findByIdentifier' | 'validatePassword'
>;

describe('LocalLoginUseCase', () => {
  let useCase: LocalLoginUseCase;
  let usersService: jest.Mocked<UsersServiceMock>;
  let sessionIssuer: jest.Mocked<SessionIssuerPort>;

  const user: User = {
    id: 1,
    username: 'testuser',
    password: 'hashed-password',
    email: 'test@example.com',
    name: 'Test User',
    socialAccounts: [],
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  beforeEach(async () => {
    usersService = {
      findByIdentifier: jest.fn(),
      validatePassword: jest.fn(),
    };
    sessionIssuer = {
      issue: jest.fn().mockResolvedValue({ accessToken: 'signed.jwt' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LocalLoginUseCase,
        { provide: UsersService, useValue: usersService },
        { provide: SESSION_ISSUER_PORT, useValue: sessionIssuer },
      ],
    }).compile();

    useCase = module.get(LocalLoginUseCase);
  });

  it('returns a JWT and public user without password', async () => {
    usersService.findByIdentifier.mockResolvedValue(user);
    usersService.validatePassword.mockResolvedValue(true);

    const result = await useCase.execute({
      identifierType: LoginIdentifierType.USERNAME,
      identifier: 'testuser',
      password: 'plain-password',
    });

    expect(result.access_token).toBe('signed.jwt');
    expect(result.user).toMatchObject({
      id: 1,
      username: 'testuser',
      email: 'test@example.com',
    });
    expect(result.user).not.toHaveProperty('password');
  });

  it('logs in with email identifier', async () => {
    usersService.findByIdentifier.mockResolvedValue(user);
    usersService.validatePassword.mockResolvedValue(true);

    const result = await useCase.execute({
      identifierType: LoginIdentifierType.EMAIL,
      identifier: 'test@example.com',
      password: 'plain-password',
    });

    expect(usersService.findByIdentifier).toHaveBeenCalledWith(
      LoginIdentifierType.EMAIL,
      'test@example.com',
    );
    expect(result.access_token).toBe('signed.jwt');
  });

  it('throws UnauthorizedException for invalid credentials', async () => {
    usersService.findByIdentifier.mockResolvedValue(user);
    usersService.validatePassword.mockResolvedValue(false);

    await expect(
      useCase.execute({
        identifierType: LoginIdentifierType.USERNAME,
        identifier: 'testuser',
        password: 'wrong-password',
      }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException when identifier is not found', async () => {
    usersService.findByIdentifier.mockResolvedValue(null);

    await expect(
      useCase.execute({
        identifierType: LoginIdentifierType.EMAIL,
        identifier: 'missing@example.com',
        password: 'plain-password',
      }),
    ).rejects.toThrow(UnauthorizedException);
  });
});
