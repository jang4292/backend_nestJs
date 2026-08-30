import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { SocialAccount } from '../entities/social-account.entity';
import { SocialIdentity } from '../domain/social-identity';
import {
  SocialAccountLinkerPort,
  SocialUserRecord,
} from '../application/ports/social-account-linker.port';

@Injectable()
export class SocialAccountLinkerTypeOrmAdapter
  implements SocialAccountLinkerPort
{
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(SocialAccount)
    private readonly socialAccountsRepository: Repository<SocialAccount>,
  ) {}

  async findBySocialId(
    provider: string,
    sub: string,
  ): Promise<SocialUserRecord | null> {
    const socialAccount = await this.socialAccountsRepository.findOne({
      where: { provider, providerUserId: sub },
      relations: ['user'],
    });
    return socialAccount ? this.toRecord(socialAccount.user) : null;
  }

  async upsert(identity: SocialIdentity): Promise<SocialUserRecord> {
    const existing = await this.socialAccountsRepository.findOne({
      where: { provider: identity.provider, providerUserId: identity.sub },
      relations: ['user'],
    });

    if (existing) {
      existing.email = identity.email ?? existing.email;
      existing.name = identity.name ?? existing.name;
      await this.socialAccountsRepository.save(existing);

      const user = existing.user;
      user.email = identity.email ?? user.email;
      user.name = identity.name ?? user.name;
      return this.toRecord(await this.usersRepository.save(user));
    }

    const username = `${identity.provider}_${identity.sub}`;
    const user = await this.usersRepository.save(
      this.usersRepository.create({
        username,
        password: null,
        email: identity.email,
        name: identity.name,
      }),
    );

    await this.socialAccountsRepository.save(
      this.socialAccountsRepository.create({
        userId: user.id,
        provider: identity.provider,
        providerUserId: identity.sub,
        email: identity.email,
        name: identity.name,
      }),
    );

    return this.toRecord(user);
  }

  private toRecord(user: User): SocialUserRecord {
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      name: user.name,
    };
  }
}
