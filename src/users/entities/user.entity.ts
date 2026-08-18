import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  username: string;

  @Column({ nullable: true })
  password: string | null;

  @Column({ nullable: true })
  email: string | null;

  @Column({ nullable: true })
  name: string | null;

  /** Social provider name, e.g. 'google' */
  @Column({ nullable: true })
  provider: string | null;

  /** Provider-specific unique user id (e.g. Google sub) */
  @Column({ nullable: true, unique: true })
  googleId: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
