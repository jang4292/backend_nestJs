import type { User } from '../../entities/user.entity';

export interface PublicUser {
  id: number;
  username: string;
  email: string | null;
  name: string | null;
  /** Linked SNS provider names, e.g. ['google', 'kakao'] */
  providers: string[];
  createdAt: Date;
  updatedAt: Date;
}

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    name: user.name,
    providers: (user.socialAccounts ?? []).map((account) => account.provider),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
