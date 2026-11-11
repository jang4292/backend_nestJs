import { VerifyCredentialsUseCase } from './verify-credentials.use-case';
import type { UserRepositoryPort } from '../ports/user-repository.port';
import type { PasswordHasherPort } from '../ports/password-hasher.port';
import type { User } from '../../entities/user.entity';
import { LoginIdentifierType } from '../../domain/login-identifier-type.enum';
import { UserRole } from '../../domain/user-role.enum';

describe('VerifyCredentialsUseCase', () => {
  const user: User = {
    id: 1,
    username: 'alice',
    email: 'alice@example.com',
    name: null,
    role: UserRole.USER,
    sessionVersion: 0,
    socialAccounts: [],
    createdAt: new Date(0),
    updatedAt: new Date(0),
  };
  let users: jest.Mocked<
    Pick<UserRepositoryPort, 'findCredentialsByIdentifier'>
  >;
  let hasher: jest.Mocked<PasswordHasherPort>;
  let useCase: VerifyCredentialsUseCase;

  beforeEach(() => {
    users = { findCredentialsByIdentifier: jest.fn() };
    hasher = { hash: jest.fn(), compare: jest.fn() };
    useCase = new VerifyCredentialsUseCase(
      users as unknown as UserRepositoryPort,
      hasher,
    );
  });

  it('returns the user when the password matches', async () => {
    users.findCredentialsByIdentifier.mockResolvedValue({
      user,
      passwordHash: 'hash',
    });
    hasher.compare.mockResolvedValue(true);

    await expect(
      useCase.execute(LoginIdentifierType.USERNAME, 'alice', 'pw'),
    ).resolves.toBe(user);
    expect(hasher.compare).toHaveBeenCalledWith('pw', 'hash');
  });

  it('returns null when the password does not match', async () => {
    users.findCredentialsByIdentifier.mockResolvedValue({
      user,
      passwordHash: 'hash',
    });
    hasher.compare.mockResolvedValue(false);

    await expect(
      useCase.execute(LoginIdentifierType.USERNAME, 'alice', 'wrong'),
    ).resolves.toBeNull();
  });

  it('still runs a password comparison when the account does not exist (timing equalization)', async () => {
    users.findCredentialsByIdentifier.mockResolvedValue(null);
    hasher.compare.mockResolvedValue(false);

    await expect(
      useCase.execute(LoginIdentifierType.EMAIL, 'missing@example.com', 'pw'),
    ).resolves.toBeNull();
    expect(hasher.compare).toHaveBeenCalledWith('pw', null);
  });
});
