import { UpdateUserUseCase } from './update-user.use-case';
import type { UserRepositoryPort } from '../ports/user-repository.port';
import type { PasswordHasherPort } from '../ports/password-hasher.port';
import type { User } from '../../entities/user.entity';
import { UserRole } from '../../domain/user-role.enum';

function buildUser(overrides: Partial<User> = {}): User {
  return {
    id: 1,
    username: 'alice',
    email: 'alice@example.com',
    name: 'Alice',
    role: UserRole.USER,
    sessionVersion: 0,
    socialAccounts: [],
    createdAt: new Date(0),
    updatedAt: new Date(0),
    ...overrides,
  };
}

describe('UpdateUserUseCase', () => {
  let users: jest.Mocked<UserRepositoryPort>;
  let hasher: jest.Mocked<PasswordHasherPort>;
  let useCase: UpdateUserUseCase;

  beforeEach(() => {
    users = {
      findById: jest.fn().mockResolvedValue(buildUser()),
      findByUsername: jest.fn(),
      findByEmail: jest.fn().mockResolvedValue(null),
      findCredentialsByIdentifier: jest.fn(),
      findPasswordHashById: jest.fn().mockResolvedValue('current-hash'),
      create: jest.fn(),
      save: jest.fn().mockImplementation((user: User) => Promise.resolve(user)),
    };
    hasher = {
      hash: jest.fn().mockResolvedValue('new-hash'),
      compare: jest.fn().mockResolvedValue(true),
    };
    useCase = new UpdateUserUseCase(users, hasher);
  });

  it('returns 404 when the user does not exist', async () => {
    users.findById.mockResolvedValue(null);

    await expect(useCase.execute(1, { name: 'x' })).rejects.toMatchObject({
      kind: 'not_found',
    });
  });

  it('updates only the provided profile fields', async () => {
    const result = await useCase.execute(1, { name: 'Alice Updated' });

    expect(result).toMatchObject({
      name: 'Alice Updated',
      email: 'alice@example.com',
    });
    expect(hasher.hash).not.toHaveBeenCalled();
  });

  it('rejects an email that belongs to another user with 409', async () => {
    users.findByEmail.mockResolvedValue(buildUser({ id: 2 }));

    await expect(
      useCase.execute(1, { email: 'taken@example.com' }),
    ).rejects.toMatchObject({ kind: 'conflict' });
    expect(users.save).not.toHaveBeenCalled();
  });

  it('requires currentPassword to change an existing password', async () => {
    await expect(
      useCase.execute(1, { password: 'new-password' }),
    ).rejects.toMatchObject({ kind: 'invalid_argument' });
    expect(users.save).not.toHaveBeenCalled();
  });

  it('rejects an incorrect currentPassword with 403', async () => {
    hasher.compare.mockResolvedValue(false);

    await expect(
      useCase.execute(1, {
        password: 'new-password',
        currentPassword: 'wrong-password',
      }),
    ).rejects.toMatchObject({ kind: 'forbidden' });
    expect(users.save).not.toHaveBeenCalled();
  });

  it('changes the password when currentPassword matches', async () => {
    const result = await useCase.execute(1, {
      password: 'new-password',
      currentPassword: 'current-password',
    });

    expect(hasher.compare).toHaveBeenCalledWith(
      'current-password',
      'current-hash',
    );
    expect(result.password).toBe('new-hash');
  });

  // AUTH-3: 비밀번호를 바꾸면 기존 세션 토큰이 모두 무효가 되도록 세션 버전을 올립니다.
  it('bumps sessionVersion when the password changes', async () => {
    users.findById.mockResolvedValue(buildUser({ sessionVersion: 3 }));

    const result = await useCase.execute(1, {
      password: 'new-password',
      currentPassword: 'current-password',
    });

    expect(result.sessionVersion).toBe(4);
  });

  it('keeps sessionVersion for profile-only updates', async () => {
    users.findById.mockResolvedValue(buildUser({ sessionVersion: 3 }));

    const result = await useCase.execute(1, { name: 'Alice Updated' });

    expect(result.sessionVersion).toBe(3);
  });

  it('lets an SNS-only account set its first password without currentPassword', async () => {
    users.findPasswordHashById.mockResolvedValue(null);

    const result = await useCase.execute(1, { password: 'first-password' });

    expect(hasher.compare).not.toHaveBeenCalled();
    expect(result.password).toBe('new-hash');
  });
});
