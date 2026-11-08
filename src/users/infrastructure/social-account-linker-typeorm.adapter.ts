import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { isDuplicateEntryError } from '../../database/mariadb-errors';
import { User } from '../entities/user.entity';
import { SocialAccount } from '../entities/social-account.entity';
import { SocialIdentity } from '../domain/social-identity';
import { socialUsername } from '../domain/reserved-usernames';
import {
  SocialAccountLinkerPort,
  SocialUserRecord,
} from '../application/ports/social-account-linker.port';

@Injectable()
export class SocialAccountLinkerTypeOrmAdapter implements SocialAccountLinkerPort {
  constructor(
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
    try {
      return await this.dataSource.transaction((manager) =>
        this.upsertInTransaction(manager, identity),
      );
    } catch (error) {
      if (!isDuplicateEntryError(error)) {
        throw error;
      }
      // 같은 SNS 계정의 최초 로그인이 동시에 들어와 다른 요청이 먼저 생성한 경우입니다.
      // 실패한 트랜잭션의 스냅샷(REPEATABLE READ)에서는 경쟁 행이 보이지 않으므로
      // 트랜잭션 밖에서 다시 조회합니다.
      const concurrent = await this.findBySocialId(
        identity.provider,
        identity.sub,
      );
      if (concurrent) {
        return concurrent;
      }
      throw error;
    }
  }

  private async upsertInTransaction(
    manager: EntityManager,
    identity: SocialIdentity,
  ): Promise<SocialUserRecord> {
    const usersRepository = manager.getRepository(User);
    const socialAccountsRepository = manager.getRepository(SocialAccount);
    const existing = await socialAccountsRepository.findOne({
      where: { provider: identity.provider, providerUserId: identity.sub },
      relations: ['user'],
    });

    if (existing) {
      // provider 측 정보는 social_accounts에 그대로 기록합니다.
      existing.email = identity.email ?? existing.email;
      existing.name = identity.name ?? existing.name;
      await socialAccountsRepository.save(existing);

      const user = existing.user;
      user.name = user.name ?? identity.name ?? null;
      // users.email은 비어 있을 때만 채웁니다. 이미 있는 email을 provider 값으로 덮어쓰지 않습니다.
      if (!user.email) {
        user.email = await this.claimableEmail(
          usersRepository,
          identity,
          user.id,
        );
      }
      return this.toRecord(await usersRepository.save(user));
    }

    const user = await usersRepository.save(
      usersRepository.create({
        username: socialUsername(identity.provider, identity.sub),
        password: null,
        email: await this.claimableEmail(usersRepository, identity),
        name: identity.name ?? null,
      }),
    );

    await socialAccountsRepository.save(
      socialAccountsRepository.create({
        userId: user.id,
        provider: identity.provider,
        providerUserId: identity.sub,
        email: identity.email ?? null,
        name: identity.name ?? null,
      }),
    );

    return this.toRecord(user);
  }

  /**
   * users.email(UNIQUE)에 provider email을 쓸 수 있는지 판단합니다.
   * - provider가 미검증(emailVerified === false)이라고 알린 email은 쓰지 않습니다.
   * - 다른 사용자가 이미 쓰는 email은 쓰지 않습니다. 기존에는 UNIQUE 위반으로 500이 났고,
   *   로컬 계정과의 자동 병합은 계정 탈취 위험이 있어 하지 않습니다.
   */
  private async claimableEmail(
    usersRepository: Repository<User>,
    identity: SocialIdentity,
    selfUserId?: number,
  ): Promise<string | null> {
    if (!identity.email || identity.emailVerified === false) {
      return null;
    }
    const owner = await usersRepository.findOne({
      where: { email: identity.email },
    });
    return owner && owner.id !== selfUserId ? null : identity.email;
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
