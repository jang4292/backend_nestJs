import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { UserRole } from '../../../users/domain/user-role.enum';
import type { PublicUser } from '../../../users/interface/presenters/public-user.presenter';
import { ROLES_METADATA_KEY } from './roles.decorator';

/**
 * JwtAuthGuard 다음에 실행되어 req.user.role이 @Roles()에 지정된 역할인지 확인합니다.
 * 역할은 JwtStrategy가 매 요청 DB에서 다시 읽으므로 권한 변경이 즉시 반영됩니다.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<
      UserRole[] | undefined
    >(ROLES_METADATA_KEY, [context.getHandler(), context.getClass()]);
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const user = context
      .switchToHttp()
      .getRequest<{ user?: Pick<PublicUser, 'role'> }>().user;
    if (!user) {
      throw new UnauthorizedException();
    }
    if (!requiredRoles.includes(user.role)) {
      throw new ForbiddenException('Insufficient role');
    }
    return true;
  }
}
