import { Controller, Post, Body } from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiOperation,
  ApiProperty,
  ApiTags,
} from '@nestjs/swagger';
import { ApiDefaultErrorResponse } from '../../../common/http/api-contract.decorators';
import { Throttle } from '@nestjs/throttler';
import {
  PublicUser,
  toPublicUser,
} from '../../../users/interface/presenters/public-user.presenter';
import { LocalLoginUseCase } from '../application/use-cases/local-login.use-case';
import { LoginDto } from './dto/login.dto';

export class LocalLoginResponse {
  @ApiProperty()
  access_token!: string;

  @ApiProperty({ type: PublicUser })
  user!: PublicUser;
}

@Controller('auth')
@ApiTags('auth')
@ApiDefaultErrorResponse()
export class AuthLocalController {
  constructor(private readonly localLoginUseCase: LocalLoginUseCase) {}

  @Post('login')
  @ApiOperation({ summary: '로컬 계정 로그인' })
  @ApiCreatedResponse({ type: LocalLoginResponse })
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async login(@Body() loginDto: LoginDto): Promise<LocalLoginResponse> {
    const { user, session } = await this.localLoginUseCase.execute(loginDto);
    return { access_token: session.accessToken, user: toPublicUser(user) };
  }
}
