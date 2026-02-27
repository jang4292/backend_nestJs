import { Injectable } from '@nestjs/common';
import { UsersService } from '../../../users/users.service';
import { SocialIdentity } from '../domain/social-identity';
import {
  SocialUserRecord,
  SocialUserRepositoryPort,
} from '../application/ports/social-user-repository.port';

@Injectable()
export class SocialUserTypeOrmAdapter implements SocialUserRepositoryPort {
  constructor(private readonly usersService: UsersService) {}

  async findBySocialId(
    provider: string,
    sub: string,
  ): Promise<SocialUserRecord | null> {
    if (provider !== 'google') return null;
    const user = await this.usersService.findByGoogleId(sub);
    if (!user) return null;
    return { id: user.id, username: user.username, email: user.email, name: user.name };
  }

  async upsert(identity: SocialIdentity): Promise<SocialUserRecord> {
    const user = await this.usersService.upsertGoogleUser(identity);
    return { id: user.id, username: user.username, email: user.email, name: user.name };
  }
}
