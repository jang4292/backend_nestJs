import {
  DataSource,
  EntityManager,
  QueryFailedError,
  Repository,
} from 'typeorm';
import { SocialAccountLinkerTypeOrmAdapter } from './social-account-linker-typeorm.adapter';
import { User } from '../entities/user.entity';
import { SocialAccount } from '../entities/social-account.entity';
import type { SocialIdentity } from '../domain/social-identity';

type RepoMock = {
  findOne: jest.Mock;
  save: jest.Mock;
  create: jest.Mock;
};

function repoMock(): RepoMock {
  return {
    findOne: jest.fn().mockResolvedValue(null),
    save: jest
      .fn()
      .mockImplementation((entity: object) =>
        Promise.resolve({ id: 10, ...entity }),
      ),
    create: jest.fn().mockImplementation((data: object) => ({ ...data })),
  };
}

describe('SocialAccountLinkerTypeOrmAdapter.upsert', () => {
  const identity: SocialIdentity = {
    provider: 'google',
    sub: 'g-123',
    email: 'alice@example.com',
    emailVerified: true,
    name: 'Alice',
  };
  let usersRepo: RepoMock;
  let socialRepo: RepoMock;
  let outerSocialRepo: RepoMock;
  let dataSource: { transaction: jest.Mock };
  let adapter: SocialAccountLinkerTypeOrmAdapter;

  beforeEach(() => {
    usersRepo = repoMock();
    socialRepo = repoMock();
    outerSocialRepo = repoMock();
    const manager = {
      getRepository: (entity: unknown) =>
        entity === User ? usersRepo : socialRepo,
    } as unknown as EntityManager;
    dataSource = {
      transaction: jest
        .fn()
        .mockImplementation((work: (m: EntityManager) => unknown) =>
          work(manager),
        ),
    };
    adapter = new SocialAccountLinkerTypeOrmAdapter(
      outerSocialRepo as unknown as Repository<SocialAccount>,
      dataSource as unknown as DataSource,
    );
  });

  it('creates a user with the reserved SNS username and claims a free verified email', async () => {
    const result = await adapter.upsert(identity);

    expect(usersRepo.create).toHaveBeenCalledWith({
      username: 'google_g-123',
      password: null,
      email: 'alice@example.com',
      name: 'Alice',
    });
    expect(socialRepo.save).toHaveBeenCalled();
    expect(result).toMatchObject({ id: 10, username: 'google_g-123' });
  });

  it('does not claim an email already used by another account (avoids UNIQUE 500)', async () => {
    usersRepo.findOne.mockResolvedValue({ id: 99, email: identity.email });

    await adapter.upsert(identity);

    expect(usersRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ email: null }),
    );
  });

  it('does not claim an email the provider reports as unverified', async () => {
    await adapter.upsert({ ...identity, emailVerified: false });

    expect(usersRepo.findOne).not.toHaveBeenCalled();
    expect(usersRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ email: null }),
    );
  });

  it('keeps the existing users.email and name for a linked account', async () => {
    const user = {
      id: 5,
      username: 'google_g-123',
      email: 'old@example.com',
      name: 'Custom',
    };
    socialRepo.findOne.mockResolvedValue({
      id: 1,
      user,
      email: null,
      name: null,
    });
    usersRepo.save.mockImplementation((u: object) => Promise.resolve(u));

    const result = await adapter.upsert(identity);

    expect(result).toMatchObject({ email: 'old@example.com', name: 'Custom' });
    expect(socialRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'alice@example.com', name: 'Alice' }),
    );
  });

  it('re-reads outside the failed transaction when a concurrent first login won the race', async () => {
    dataSource.transaction.mockRejectedValue(
      new QueryFailedError(
        'INSERT',
        [],
        Object.assign(new Error('dup'), { code: 'ER_DUP_ENTRY', errno: 1062 }),
      ),
    );
    outerSocialRepo.findOne.mockResolvedValue({
      user: { id: 7, username: 'google_g-123', email: null, name: null },
    });

    await expect(adapter.upsert(identity)).resolves.toMatchObject({ id: 7 });
  });
});
