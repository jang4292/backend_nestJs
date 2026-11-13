import { ApiProperty } from '@nestjs/swagger';
import type { User } from '../../entities/user.entity';
import { UserRole } from '../../domain/user-role.enum';

export class PublicUser {
  @ApiProperty({ type: 'integer' })
  id!: number;

  @ApiProperty()
  username!: string;

  @ApiProperty({ type: String, nullable: true })
  email!: string | null;

  @ApiProperty({ type: String, nullable: true })
  name!: string | null;

  @ApiProperty({ enum: UserRole })
  role!: UserRole;

  /** Linked SNS provider names, e.g. ['google', 'kakao'] */
  @ApiProperty({ type: [String] })
  providers!: string[];

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: Date;
}

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    name: user.name,
    role: user.role,
    providers: (user.socialAccounts ?? []).map((account) => account.provider),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
