import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { User } from './user.entity';

@Entity('social_accounts')
@Unique('UQ_social_accounts_provider_provider_user_id', [
  'provider',
  'providerUserId',
])
export class SocialAccount {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: number;

  @ManyToOne(() => User, (user) => user.socialAccounts, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'userId' })
  user: User;

  /** e.g. 'google' | 'apple' | 'facebook' | 'kakao' | 'naver' */
  @Column()
  provider: string;

  /** Provider-specific unique user id (e.g. Google sub) */
  @Column()
  providerUserId: string;

  @Column({ nullable: true })
  email: string | null;

  @Column({ nullable: true })
  name: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
