import { SocialIdentity } from '../../domain/social-identity';

export const SOCIAL_ACCOUNT_LINKER_PORT = Symbol('SocialAccountLinkerPort');

export interface SocialUserRecord {
  id: number;
  username: string;
  email?: string | null;
  name?: string | null;
}

export interface SocialAccountLinkerPort {
  findBySocialId(
    provider: string,
    sub: string,
  ): Promise<SocialUserRecord | null>;
  upsert(identity: SocialIdentity): Promise<SocialUserRecord>;
}
