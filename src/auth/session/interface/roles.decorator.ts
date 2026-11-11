import { SetMetadata } from '@nestjs/common';
import type { UserRole } from '../../../users/domain/user-role.enum';

export const ROLES_METADATA_KEY = 'auth:roles';

/** 라우트에 필요한 역할을 지정합니다. RolesGuard와 함께 사용합니다. */
export const Roles = (...roles: UserRole[]) =>
  SetMetadata(ROLES_METADATA_KEY, roles);
