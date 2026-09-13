import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, QueryFailedError, Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { SocialAccount } from '../entities/social-account.entity';
import { SocialIdentity } from '../domain/social-identity';
import {
  SocialAccountLinkerPort,
  SocialUserRecord,
} from '../application/ports/social-account-linker.port';

@Injectable()
export class SocialAccountLinkerTypeOrmAdapter implements SocialAccountLinkerPort {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(SocialAccount)
    private readonly socialAccountsRepository: Repository<SocialAccount>,
    private readonly dataSource: DataSource,
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
    return this.dataSource.transaction(async (manager) => {
      const usersRepository = manager.getRepository(User);
      const socialAccountsRepository = manager.getRepository(SocialAccount);
      const existing = await socialAccountsRepository.findOne({
        where: { provider: identity.provider, providerUserId: identity.sub },
        relations: ['user'],
      });

      if (existing) {
        existing.email = identity.email ?? existing.email;
        existing.name = identity.name ?? existing.name;
        await socialAccountsRepository.save(existing);

        const user = existing.user;
        user.email = identity.email ?? user.email;
        user.name = identity.name ?? user.name;
        return this.toRecord(await usersRepository.save(user));
      }

      const username = `${identity.provider}_${identity.sub}`;
      try {
        const user = await usersRepository.save(
          usersRepository.create({
            username,
            password: null,
            email: identity.email,
            name: identity.name,
          }),
        );

        await socialAccountsRepository.save(
          socialAccountsRepository.create({
            userId: user.id,
            provider: identity.provider,
            providerUserId: identity.sub,
            email: identity.email,
            name: identity.name,
          }),
        );

        return this.toRecord(user);
      } catch (error) {
        if (!isDuplicateKeyError(error)) {
          throw error;
        }

        const concurrentAccount = await socialAccountsRepository.findOne({
          where: {
            provider: identity.provider,
            providerUserId: identity.sub,
          },
          relations: ['user'],
        });
        if (concurrentAccount) {
          return this.toRecord(concurrentAccount.user);
        }
        throw error;
      }
    });
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

function isDuplicateKeyError(error: unknown): boolean {
  if (!(error instanceof QueryFailedError)) {
    return false;
  }

  const driverError = error.driverError as { code?: unknown } | undefined;
  return driverError?.code === 'ER_DUP_ENTRY' || driverError?.code === '23505';
}
