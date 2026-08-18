import type { User } from '../entities/user.entity';

export interface PublicUser {
  id: number;
  username: string;
  email: string | null;
  name: string | null;
  provider: string | null;
  googleId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    name: user.name,
    provider: user.provider,
    googleId: user.googleId,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
