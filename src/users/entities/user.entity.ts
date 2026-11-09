import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { UserRole } from '../domain/user-role.enum';
import { SocialAccount } from './social-account.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  username: string;

  /**
   * bcrypt 해시. `select: false`이므로 일반 조회 결과에는 존재하지 않으며,
   * 로그인·비밀번호 변경 경로에서만 UserRepositoryPort가 명시적으로 조회합니다.
   */
  @Column({ type: 'varchar', nullable: true, select: false })
  password?: string | null;

  @Column({ type: 'varchar', nullable: true, unique: true })
  email: string | null;

  @Column({ type: 'varchar', nullable: true })
  name: string | null;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.USER,
  })
  role: UserRole;

  /**
   * 세션 무효화 버전(AUTH-3). 세션 JWT의 `sv`와 다르면 JwtStrategy가 401을 반환합니다.
   * 비밀번호를 바꾸면 1 증가해 기존 토큰이 모두 무효가 됩니다.
   */
  @Column({ type: 'int', unsigned: true, default: 0 })
  sessionVersion: number;

  @OneToMany(() => SocialAccount, (socialAccount) => socialAccount.user)
  socialAccounts: SocialAccount[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
