import { UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { User } from '../../../users/entities/user.entity';
import { UserRole } from '../../../users/domain/user-role.enum';
import { JwtStrategy } from './jwt.strategy';

function buildUser(overrides: Partial<User> = {}): User {
  return {
    id: 7,
    username: 'alice',
    email: null,
    name: null,
    role: UserRole.USER,
    sessionVersion: 0,
    socialAccounts: [],
    createdAt: new Date(0),
    updatedAt: new Date(0),
    ...overrides,
  };
}

describe('JwtStrategy.validate', () => {
  let findById: jest.Mock;
  let strategy: JwtStrategy;

  beforeEach(() => {
    findById = jest.fn();
    strategy = new JwtStrategy(
      {
        get: () => 'test-secret-0123456789abcdef0123456789',
      } as never as ConfigService,
      { findById } as never,
    );
  });

  it('returns the public user when the session version matches', async () => {
    findById.mockResolvedValue(buildUser({ sessionVersion: 2 }));

    await expect(
      strategy.validate({ sub: 7, username: 'alice', sv: 2 }),
    ).resolves.toMatchObject({ id: 7, username: 'alice' });
  });

  // AUTH-3: 비밀번호 변경으로 버전이 올라가면 이전 토큰은 거부됩니다.
  it('rejects a token issued before the session version was bumped', async () => {
    findById.mockResolvedValue(buildUser({ sessionVersion: 3 }));

    await expect(
      strategy.validate({ sub: 7, username: 'alice', sv: 2 }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  // 배포 전에 발급된 토큰(sv 없음)은 버전 0으로 간주해 배포 직후에도 유효합니다.
  it('accepts legacy tokens without sv while the user is still at version 0', async () => {
    findById.mockResolvedValue(buildUser({ sessionVersion: 0 }));

    await expect(
      strategy.validate({ sub: 7, username: 'alice' }),
    ).resolves.toMatchObject({ id: 7 });
  });

  it('rejects legacy tokens after the user changed the password', async () => {
    findById.mockResolvedValue(buildUser({ sessionVersion: 1 }));

    await expect(
      strategy.validate({ sub: 7, username: 'alice' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects tokens for deleted users', async () => {
    findById.mockResolvedValue(null);

    await expect(
      strategy.validate({ sub: 7, username: 'alice', sv: 0 }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
