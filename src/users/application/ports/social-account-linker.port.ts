import { SocialIdentity } from '../../domain/social-identity';

export const SOCIAL_ACCOUNT_LINKER_PORT = Symbol('SocialAccountLinkerPort');

export interface SocialUserRecord {
  id: number;
  username: string;
  email?: string | null;
  name?: string | null;
  /** 세션 JWT에 넣는 무효화 버전(users.sessionVersion) */
  sessionVersion?: number;
}

export interface SocialAccountLinkerPort {
  findBySocialId(
    provider: string,
    sub: string,
  ): Promise<SocialUserRecord | null>;
  upsert(identity: SocialIdentity): Promise<SocialUserRecord>;
}
