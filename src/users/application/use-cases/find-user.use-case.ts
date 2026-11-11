import { Inject, Injectable } from '@nestjs/common';
import type { User } from '../../entities/user.entity';
import { USER_REPOSITORY_PORT } from '../ports/user-repository.port';
import type { UserRepositoryPort } from '../ports/user-repository.port';

@Injectable()
export class FindUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY_PORT)
    private readonly users: UserRepositoryPort,
  ) {}

  byUsername(username: string): Promise<User | null> {
    return this.users.findByUsername(username);
  }

  byEmail(email: string): Promise<User | null> {
    return this.users.findByEmail(email);
  }

  /** 연결된 SNS 계정(providers)을 포함해 조회합니다. */
  byId(id: number): Promise<User | null> {
    return this.users.findById(id);
  }
}
