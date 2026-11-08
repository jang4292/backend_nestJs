import { Controller, Post, Body } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  PublicUser,
  toPublicUser,
} from '../../../users/interface/presenters/public-user.presenter';
import { LocalLoginUseCase } from '../application/use-cases/local-login.use-case';
import { LoginDto } from './dto/login.dto';

export interface LocalLoginResponse {
  access_token: string;
  user: PublicUser;
}

@Controller('auth')
@ApiTags('auth')
export class AuthLocalController {
  constructor(private readonly localLoginUseCase: LocalLoginUseCase) {}

  @Post('login')
  @ApiOperation({ summary: '로컬 계정 로그인' })
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async login(@Body() loginDto: LoginDto): Promise<LocalLoginResponse> {
    const { user, session } = await this.localLoginUseCase.execute(loginDto);
    return { access_token: session.accessToken, user: toPublicUser(user) };
  }
}
