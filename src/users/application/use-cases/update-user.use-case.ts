import { Inject, Injectable } from '@nestjs/common';
import {
  ConflictError,
  ForbiddenError,
  InvalidArgumentError,
  NotFoundError,
} from '../../../common/errors/domain-error';
import type { User } from '../../entities/user.entity';
import { PASSWORD_HASHER_PORT } from '../ports/password-hasher.port';
import type { PasswordHasherPort } from '../ports/password-hasher.port';
import { USER_REPOSITORY_PORT } from '../ports/user-repository.port';
import type { UserRepositoryPort } from '../ports/user-repository.port';

export interface UpdateProfileCommand {
  email?: string;
  name?: string;
  /** 새 비밀번호 */
  password?: string;
  /** 기존 비밀번호가 있는 계정이 password를 바꿀 때 필수 */
  currentPassword?: string;
}

@Injectable()
export class UpdateUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY_PORT)
    private readonly users: UserRepositoryPort,
    @Inject(PASSWORD_HASHER_PORT)
    private readonly passwordHasher: PasswordHasherPort,
  ) {}

  async execute(id: number, command: UpdateProfileCommand): Promise<User> {
    const user = await this.users.findById(id);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    if (command.email !== undefined && command.email !== user.email) {
      const owner = await this.users.findByEmail(command.email);
      if (owner && owner.id !== user.id) {
        throw new ConflictError('Email already exists');
      }
      user.email = command.email;
    }

    if (command.name !== undefined) {
      user.name = command.name;
    }

    if (command.password !== undefined) {
      await this.assertCanChangePassword(user.id, command.currentPassword);
      user.password = await this.passwordHasher.hash(command.password);
      // 기존에 발급된 모든 세션 토큰(탈취된 토큰 포함)을 무효화합니다. 현재 토큰도 무효가 되므로 다시 로그인합니다.
      user.sessionVersion = (user.sessionVersion ?? 0) + 1;
    }

    return this.users.save(user);
  }

  /**
   * 탈취된 access token만으로 비밀번호를 바꿔 계정을 영구 장악하지 못하도록
   * 기존 비밀번호 확인을 요구합니다. 비밀번호가 없는 SNS 전용 계정은 최초 설정을 허용합니다.
   */
  private async assertCanChangePassword(
    userId: number,
    currentPassword: string | undefined,
  ): Promise<void> {
    const currentHash = await this.users.findPasswordHashById(userId);
    if (!currentHash) {
      return;
    }
    if (!currentPassword) {
      throw new InvalidArgumentError(
        'currentPassword is required to change the password',
      );
    }
    if (!(await this.passwordHasher.compare(currentPassword, currentHash))) {
      throw new ForbiddenError('Current password is incorrect');
    }
  }
}
