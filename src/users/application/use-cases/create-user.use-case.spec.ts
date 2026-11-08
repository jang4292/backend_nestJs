import { CreateUserUseCase } from './create-user.use-case';
import type {
  NewUserData,
  UserRepositoryPort,
} from '../ports/user-repository.port';
import type { PasswordHasherPort } from '../ports/password-hasher.port';
import type { User } from '../../entities/user.entity';
import { UserRole } from '../../domain/user-role.enum';

function buildUser(overrides: Partial<User> = {}): User {
  return {
    id: 1,
    username: 'alice',
    email: 'alice@example.com',
    name: null,
    role: UserRole.USER,
    socialAccounts: [],
    createdAt: new Date(0),
    updatedAt: new Date(0),
    ...overrides,
  };
}

describe('CreateUserUseCase', () => {
  let users: jest.Mocked<UserRepositoryPort>;
  let hasher: jest.Mocked<PasswordHasherPort>;
  let useCase: CreateUserUseCase;

  beforeEach(() => {
    users = {
      findById: jest.fn(),
      findByUsername: jest.fn().mockResolvedValue(null),
      findByEmail: jest.fn().mockResolvedValue(null),
      findCredentialsByIdentifier: jest.fn(),
      findPasswordHashById: jest.fn(),
      create: jest
        .fn()
        .mockImplementation((data: NewUserData) =>
          Promise.resolve(
            buildUser({ username: data.username, email: data.email }),
          ),
        ),
      save: jest.fn(),
    };
    hasher = {
      hash: jest.fn().mockResolvedValue('hashed'),
      compare: jest.fn(),
    };
    useCase = new CreateUserUseCase(users, hasher);
  });

  it('hashes the password and stores the new user', async () => {
    await useCase.execute({
      username: 'alice',
      password: 'plain-password',
      email: 'alice@example.com',
    });

    expect(hasher.hash).toHaveBeenCalledWith('plain-password');
    expect(users.create).toHaveBeenCalledWith({
      username: 'alice',
      passwordHash: 'hashed',
      email: 'alice@example.com',
      name: null,
    });
  });

  it('rejects a duplicate username with a 409 domain error', async () => {
    users.findByUsername.mockResolvedValue(buildUser());

    await expect(
      useCase.execute({ username: 'alice', password: 'plain-password' }),
    ).rejects.toMatchObject({ kind: 'conflict' });
    expect(users.create).not.toHaveBeenCalled();
  });

  it('rejects a duplicate email with a 409 domain error', async () => {
    users.findByEmail.mockResolvedValue(buildUser({ id: 2 }));

    await expect(
      useCase.execute({
        username: 'bob',
        password: 'plain-password',
        email: 'alice@example.com',
      }),
    ).rejects.toMatchObject({
      kind: 'conflict',
      message: 'Email already exists',
    });
  });

  it.each(['google_123', 'Kakao_999', 'naver_abc'])(
    'rejects the reserved SNS username %p',
    async (username) => {
      await expect(
        useCase.execute({ username, password: 'plain-password' }),
      ).rejects.toMatchObject({ kind: 'invalid_argument' });
      expect(users.create).not.toHaveBeenCalled();
    },
  );
});
