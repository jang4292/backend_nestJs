import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import type { User } from '../users/entities/user.entity';

type UsersServiceMock = Pick<UsersService, 'findOne' | 'validatePassword'>;
type JwtServiceMock = Pick<JwtService, 'sign'>;

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<UsersServiceMock>;
  let jwtService: jest.Mocked<JwtServiceMock>;

  const user: User = {
    id: 1,
    username: 'testuser',
    password: 'hashed-password',
    email: 'test@example.com',
    name: 'Test User',
    provider: null,
    googleId: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  beforeEach(async () => {
    usersService = {
      findOne: jest.fn(),
      validatePassword: jest.fn(),
    };
    jwtService = {
      sign: jest.fn().mockReturnValue('signed.jwt'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  it('returns a JWT and public user without password', async () => {
    usersService.findOne.mockResolvedValue(user);
    usersService.validatePassword.mockResolvedValue(true);

    const result = await service.login({
      username: 'testuser',
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

  it('throws UnauthorizedException for invalid credentials', async () => {
    usersService.findOne.mockResolvedValue(user);
    usersService.validatePassword.mockResolvedValue(false);

    await expect(
      service.login({
        username: 'testuser',
        password: 'wrong-password',
      }),
    ).rejects.toThrow(UnauthorizedException);
  });
});
