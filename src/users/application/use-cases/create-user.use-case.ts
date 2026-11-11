import { Inject, Injectable } from '@nestjs/common';
import {
  ConflictError,
  InvalidArgumentError,
} from '../../../common/errors/domain-error';
import { isReservedUsername } from '../../domain/reserved-usernames';
import type { User } from '../../entities/user.entity';
import { PASSWORD_HASHER_PORT } from '../ports/password-hasher.port';
import type { PasswordHasherPort } from '../ports/password-hasher.port';
import { USER_REPOSITORY_PORT } from '../ports/user-repository.port';
import type { UserRepositoryPort } from '../ports/user-repository.port';

export interface CreateUserCommand {
  username: string;
  password: string;
  email?: string;
  name?: string;
}

@Injectable()
export class CreateUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY_PORT)
    private readonly users: UserRepositoryPort,
    @Inject(PASSWORD_HASHER_PORT)
    private readonly passwordHasher: PasswordHasherPort,
  ) {}

  async execute(command: CreateUserCommand): Promise<User> {
    if (isReservedUsername(command.username)) {
      throw new InvalidArgumentError(
        'Usernames starting with an SNS provider prefix (e.g. google_) are reserved',
      );
    }

    if (await this.users.findByUsername(command.username)) {
      throw new ConflictError('Username already exists');
    }

    if (command.email && (await this.users.findByEmail(command.email))) {
      throw new ConflictError('Email already exists');
    }

    return this.users.create({
      username: command.username,
      passwordHash: await this.passwordHasher.hash(command.password),
      email: command.email ?? null,
      name: command.name ?? null,
    });
  }
}
