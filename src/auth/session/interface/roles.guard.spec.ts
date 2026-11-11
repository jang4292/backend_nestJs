import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../../../users/domain/user-role.enum';
import { RolesGuard } from './roles.guard';

function contextWith(
  user: { role: UserRole } | undefined,
  requiredRoles: UserRole[] | undefined,
): { context: ExecutionContext; reflector: Reflector } {
  const reflector = new Reflector();
  jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(requiredRoles);
  const context = {
    getHandler: () => () => undefined,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
  return { context, reflector };
}

describe('RolesGuard', () => {
  it('allows routes without @Roles metadata', () => {
    const { context, reflector } = contextWith(undefined, undefined);
    expect(new RolesGuard(reflector).canActivate(context)).toBe(true);
  });

  it('allows a user with a required role', () => {
    const { context, reflector } = contextWith({ role: UserRole.ADMIN }, [
      UserRole.ADMIN,
    ]);
    expect(new RolesGuard(reflector).canActivate(context)).toBe(true);
  });

  it('rejects a regular user from an admin route with 403', () => {
    const { context, reflector } = contextWith({ role: UserRole.USER }, [
      UserRole.ADMIN,
    ]);
    expect(() => new RolesGuard(reflector).canActivate(context)).toThrow(
      ForbiddenException,
    );
  });

  it('rejects an unauthenticated request with 401', () => {
    const { context, reflector } = contextWith(undefined, [UserRole.ADMIN]);
    expect(() => new RolesGuard(reflector).canActivate(context)).toThrow(
      UnauthorizedException,
    );
  });
});
