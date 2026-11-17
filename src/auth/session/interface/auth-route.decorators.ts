import { applyDecorators, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ApiErrorResponseDto } from '../../../common/http/api-contract.dto';
import { UserRole } from '../../../users/domain/user-role.enum';
import { JwtAuthGuard } from './jwt-auth.guard';
import { Roles } from './roles.decorator';
import { RolesGuard } from './roles.guard';

/**
 * JWT를 검증한 로그인 사용자만 접근하도록 합니다.
 * Require a valid JWT before the route handler runs.
 */
export function Authenticated(): MethodDecorator & ClassDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiUnauthorizedResponse({
      description: 'Bearer token이 없거나 유효하지 않음',
      type: ApiErrorResponseDto,
    }),
    UseGuards(JwtAuthGuard),
  );
}

/**
 * JWT를 먼저 검증하고 현재 DB에서 읽은 사용자 역할이 admin인지 검사합니다.
 * Verify the JWT first, then require the current user's admin role.
 */
export function AdminOnly(): MethodDecorator & ClassDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiUnauthorizedResponse({
      description: 'Bearer token이 없거나 유효하지 않음',
      type: ApiErrorResponseDto,
    }),
    ApiForbiddenResponse({
      description: 'admin 역할이 아님',
      type: ApiErrorResponseDto,
    }),
    Roles(UserRole.ADMIN),
    UseGuards(JwtAuthGuard, RolesGuard),
  );
}
