import type { User } from '../../entities/user.entity';
import type { LoginIdentifierType } from '../../domain/login-identifier-type.enum';

export const USER_REPOSITORY_PORT = Symbol('UserRepositoryPort');

export interface NewUserData {
  username: string;
  passwordHash: string | null;
  email: string | null;
  name: string | null;
}

export interface UserCredentials {
  /** password 속성이 제거된 사용자 */
  user: User;
  passwordHash: string | null;
}

/**
 * Users 영속성 포트. use-case는 TypeORM Repository 대신 이 포트에만 의존합니다.
 * 반환되는 User에는 password 해시가 포함되지 않습니다(UserCredentials 제외).
 */
export interface UserRepositoryPort {
  /** 연결된 socialAccounts를 함께 로드합니다(PublicUser.providers). */
  findById(id: number): Promise<User | null>;
  findByUsername(username: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  /** 로그인 전용: password 해시를 분리해 함께 반환합니다. */
  findCredentialsByIdentifier(
    identifierType: LoginIdentifierType,
    identifier: string,
  ): Promise<UserCredentials | null>;
  findPasswordHashById(id: number): Promise<string | null>;
  /** 저장 후 socialAccounts를 포함한 사용자 반환. UNIQUE 위반은 ConflictError. */
  create(data: NewUserData): Promise<User>;
  /** 변경 저장. UNIQUE(email) 위반은 ConflictError. */
  save(user: User): Promise<User>;
}
