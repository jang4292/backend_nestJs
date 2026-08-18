import { Inject, Injectable } from '@nestjs/common';
import type { SocialIdentity } from '../../domain/social-identity';
import { SOCIAL_USER_REPOSITORY_PORT } from '../ports/social-user-repository.port';
import type {
  SocialUserRecord,
  SocialUserRepositoryPort,
} from '../ports/social-user-repository.port';

@Injectable()
export class UpsertSocialUserUseCase {
  constructor(
    @Inject(SOCIAL_USER_REPOSITORY_PORT)
    private readonly repo: SocialUserRepositoryPort,
  ) {}

  async execute(identity: SocialIdentity): Promise<SocialUserRecord> {
    return this.repo.upsert(identity);
  }
}
