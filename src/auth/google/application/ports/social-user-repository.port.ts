import { SocialIdentity } from '../../domain/social-identity';

export const SOCIAL_USER_REPOSITORY_PORT = Symbol('SocialUserRepositoryPort');

export interface SocialUserRecord {
  id: number;
  username: string;
  email?: string;
  name?: string;
}

export interface SocialUserRepositoryPort {
  findBySocialId(
    provider: string,
    sub: string,
  ): Promise<SocialUserRecord | null>;
  upsert(identity: SocialIdentity): Promise<SocialUserRecord>;
}
