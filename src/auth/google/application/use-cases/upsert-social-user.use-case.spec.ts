import { UpsertSocialUserUseCase } from './upsert-social-user.use-case';
import {
  SOCIAL_USER_REPOSITORY_PORT,
  SocialUserRecord,
  SocialUserRepositoryPort,
} from '../ports/social-user-repository.port';
import { SocialIdentity } from '../../domain/social-identity';
import { Test } from '@nestjs/testing';

describe('UpsertSocialUserUseCase', () => {
  let useCase: UpsertSocialUserUseCase;
  let repo: jest.Mocked<SocialUserRepositoryPort>;

  const identity: SocialIdentity = {
    provider: 'google',
    sub: '117123456789',
    email: 'user@example.com',
    name: 'Test User',
  };

  const record: SocialUserRecord = {
    id: 1,
    username: 'google_117123456789',
    email: 'user@example.com',
    name: 'Test User',
  };

  beforeEach(async () => {
    repo = { findBySocialId: jest.fn(), upsert: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        UpsertSocialUserUseCase,
        { provide: SOCIAL_USER_REPOSITORY_PORT, useValue: repo },
      ],
    }).compile();

    useCase = module.get(UpsertSocialUserUseCase);
  });

  it('should return the upserted user record', async () => {
    repo.upsert.mockResolvedValue(record);
    const result = await useCase.execute(identity);
    expect(result).toEqual(record);
    expect(repo.upsert).toHaveBeenCalledWith(identity);
  });
});
