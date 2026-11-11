import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConflictError } from '../../common/errors/domain-error';
import { isDuplicateEntryError } from '../../database/mariadb-errors';
import { LoginIdentifierType } from '../domain/login-identifier-type.enum';
import { User } from '../entities/user.entity';
import type {
  NewUserData,
  UserCredentials,
  UserRepositoryPort,
} from '../application/ports/user-repository.port';

@Injectable()
export class UserTypeOrmRepository implements UserRepositoryPort {
  constructor(
    @InjectRepository(User)
    private readonly repo: Repository<User>,
  ) {}

  findById(id: number): Promise<User | null> {
    return this.repo.findOne({
      where: { id },
      relations: { socialAccounts: true },
    });
  }

  findByUsername(username: string): Promise<User | null> {
    return this.repo.findOne({ where: { username } });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.repo.findOne({ where: { email } });
  }

  async findCredentialsByIdentifier(
    identifierType: LoginIdentifierType,
    identifier: string,
  ): Promise<UserCredentials | null> {
    const column =
      identifierType === LoginIdentifierType.EMAIL ? 'email' : 'username';
    const user = await this.repo
      .createQueryBuilder('user')
      .addSelect('user.password')
      .leftJoinAndSelect('user.socialAccounts', 'socialAccount')
      .where(`user.${column} = :identifier`, { identifier })
      .getOne();
    if (!user) {
      return null;
    }

    const passwordHash = user.password ?? null;
    delete user.password;
    return { user, passwordHash };
  }

  async findPasswordHashById(id: number): Promise<string | null> {
    const row = await this.repo
      .createQueryBuilder('user')
      .select('user.id')
      .addSelect('user.password')
      .where('user.id = :id', { id })
      .getOne();
    return row?.password ?? null;
  }

  async create(data: NewUserData): Promise<User> {
    const saved = await this.persist(
      this.repo.create({
        username: data.username,
        password: data.passwordHash,
        email: data.email,
        name: data.name,
      }),
    );
    return (await this.findById(saved.id)) ?? saved;
  }

  async save(user: User): Promise<User> {
    await this.persist(user);
    return (await this.findById(user.id)) ?? user;
  }

  private async persist(user: User): Promise<User> {
    try {
      return await this.repo.save(user);
    } catch (error) {
      if (isDuplicateEntryError(error)) {
        // username/email UNIQUE 제약: 사전 중복 검사와 저장 사이의 경합을 409로 처리합니다.
        throw new ConflictError('Username or email already exists');
      }
      throw error;
    }
  }
}
