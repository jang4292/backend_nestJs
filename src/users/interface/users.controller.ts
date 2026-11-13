import { Controller, Get, Post, Body, Patch, Request } from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ApiDefaultErrorResponse } from '../../common/http/api-contract.decorators';
import { Authenticated } from '../../auth/session/interface/auth-route.decorators';
import { UsersService } from '../users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import type { AuthenticatedRequest } from '../../common/auth/authenticated-request';
import { toPublicUser } from './presenters/public-user.presenter';
import { PublicUser } from './presenters/public-user.presenter';

@Controller('users')
@ApiTags('users')
@ApiDefaultErrorResponse()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('register')
  @ApiOperation({ summary: '사용자 등록' })
  @ApiCreatedResponse({ type: PublicUser })
  async register(@Body() createUserDto: CreateUserDto): Promise<PublicUser> {
    const user = await this.usersService.create(createUserDto);
    return toPublicUser(user);
  }

  @Authenticated()
  @Get('profile')
  @ApiOperation({ summary: '현재 사용자 프로필 조회' })
  @ApiOkResponse({ type: PublicUser })
  getProfile(@Request() req: AuthenticatedRequest): PublicUser {
    return req.user;
  }

  @Authenticated()
  @Patch('profile')
  @ApiOperation({
    summary: '현재 사용자 프로필 수정',
    description:
      'password를 바꿀 때는 currentPassword가 필요합니다(비밀번호가 없는 SNS 전용 계정은 최초 설정 허용).',
  })
  @ApiOkResponse({ type: PublicUser })
  async updateProfile(
    @Request() req: AuthenticatedRequest,
    @Body() updateUserDto: UpdateUserDto,
  ): Promise<PublicUser> {
    const updatedUser = await this.usersService.update(
      req.user.id,
      updateUserDto,
    );
    return toPublicUser(updatedUser);
  }
}
