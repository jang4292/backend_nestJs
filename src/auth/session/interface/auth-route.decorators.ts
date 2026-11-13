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

/** 로그인한 사용자만 접근 가능한 라우트 */
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

/** admin 역할만 접근 가능한 라우트(카탈로그/음원 관리 등 쓰기 작업) */
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
