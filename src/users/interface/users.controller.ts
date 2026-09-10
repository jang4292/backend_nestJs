import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  UseGuards,
  Request,
  ValidationPipe,
} from '@nestjs/common';
import { UsersService } from '../users.service';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../../auth/session/interface/jwt-auth.guard';
import type { AuthenticatedRequest } from '../../common/auth/authenticated-request';
import { toPublicUser } from './presenters/public-user.presenter';
import type { PublicUser } from './presenters/public-user.presenter';

@Controller('users')
@ApiTags('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('register')
  @ApiOperation({ summary: '사용자 등록' })
  async register(
    @Body(ValidationPipe) createUserDto: CreateUserDto,
  ): Promise<PublicUser> {
    const user = await this.usersService.create(createUserDto);
    return toPublicUser(user);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('profile')
  @ApiOperation({ summary: '현재 사용자 프로필 조회' })
  getProfile(@Request() req: AuthenticatedRequest): PublicUser {
    return req.user;
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Patch('profile')
  @ApiOperation({ summary: '현재 사용자 프로필 수정' })
  async updateProfile(
    @Request() req: AuthenticatedRequest,
    @Body(ValidationPipe) updateUserDto: UpdateUserDto,
  ): Promise<PublicUser> {
    const updatedUser = await this.usersService.update(
      req.user.id,
      updateUserDto,
    );
    return toPublicUser(updatedUser);
  }
}
